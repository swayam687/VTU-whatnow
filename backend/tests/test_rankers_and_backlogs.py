import unittest
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Student, Subject, Mark
from app.main import (
    get_leaderboard,
    compute_backlog_analytics,
    get_effective_student_marks,
    is_failed_status,
    is_passed_status,
    recalculate_cumulative_totals,
)


class TestRankersAndBacklogsCalculations(unittest.TestCase):
    def setUp(self):
        # Create an isolated in-memory SQLite database for exact calculation testing
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_status_helpers(self):
        self.assertTrue(is_failed_status("F"))
        self.assertTrue(is_failed_status("A"))
        self.assertTrue(is_failed_status("AB"))
        self.assertTrue(is_failed_status("W"))
        self.assertTrue(is_failed_status("fail"))
        self.assertTrue(is_failed_status("ABSENT"))
        self.assertFalse(is_failed_status("P"))
        self.assertFalse(is_failed_status("PASS"))

        self.assertTrue(is_passed_status("P"))
        self.assertTrue(is_passed_status("pass"))
        self.assertFalse(is_passed_status("F"))
        self.assertFalse(is_passed_status("AB"))

    def test_effective_student_marks_deduplication(self):
        # Student took 21MAT11 in Sem 1 and failed (35 marks, F)
        # Student retook 21MAT11 in Sem 2 and passed (65 marks, P)
        m1 = Mark(usn="1RM23CS001", subject_code="21MAT11", semester="1", total=35, max_marks=100, status="F")
        m2 = Mark(usn="1RM23CS001", subject_code="21MAT11", semester="2", total=65, max_marks=100, status="P")
        m3 = Mark(usn="1RM23CS001", subject_code="21CS32", semester="2", total=75, max_marks=100, status="P")

        effective = get_effective_student_marks([m1, m2, m3])
        self.assertEqual(len(effective), 2)
        self.assertEqual(effective["21MAT11"].status, "P")
        self.assertEqual(effective["21MAT11"].total, 65)
        self.assertEqual(effective["21CS32"].status, "P")

    def test_top_ranker_leaderboard_eligibility_and_tie_breaking(self):
        # Create students in CSE
        # Student A: 88.0% but has 1 backlog -> Ineligible for merit leaderboard over clean students
        s_a = Student(usn="1RM23CS001", name="Backlog Topper", branch="CSE", percentage=88.0, total_marks=704, max_marks=800, total_backlogs=1, cgpa=7.5)
        # Student B: 85.0% with 0 backlogs, total_marks 680, cgpa 8.5
        s_b = Student(usn="1RM23CS002", name="Clean B", branch="CSE", percentage=85.0, total_marks=680, max_marks=800, total_backlogs=0, cgpa=8.5)
        # Student C: 85.0% with 0 backlogs, total_marks 682, cgpa 8.6 -> Should beat Student B on total marks / cgpa
        s_c = Student(usn="1RM23CS003", name="Clean C", branch="CSE", percentage=85.0, total_marks=682, max_marks=800, total_backlogs=0, cgpa=8.6)
        # Student D: 92.0% with 0 backlogs -> Campus Top Performer
        s_d = Student(usn="1RM23CS004", name="Campus Top", branch="CSE", percentage=92.0, total_marks=736, max_marks=800, total_backlogs=0, cgpa=9.2)

        self.db.add_all([s_a, s_b, s_c, s_d])
        self.db.commit()

        toppers = get_leaderboard(branch="CSE", limit=5, db=self.db)
        # Order must be: Student D (92%), Student C (85%, 682 pts), Student B (85%, 680 pts)
        self.assertEqual(len(toppers), 3)
        self.assertEqual(toppers[0].usn, "1RM23CS004")
        self.assertEqual(toppers[1].usn, "1RM23CS003")
        self.assertEqual(toppers[2].usn, "1RM23CS002")

        # Ineligible student A with backlogs must NOT be on the leaderboard
        self.assertNotIn("1RM23CS001", [t.usn for t in toppers])

    def test_branch_and_subject_backlog_analytics(self):
        # Setup subjects
        sub1 = Subject(code="21MAT11", name="Mathematics-I")
        sub2 = Subject(code="21CS32", name="Data Structures")
        self.db.add_all([sub1, sub2])

        # CSE Student 1: Cleared Math on re-evaluation (Sem 1 F, Sem 2 P)
        st_cse1 = Student(usn="1RM23CS001", name="Alice", branch="CSE", total_backlogs=0)
        m_cse1_a = Mark(usn="1RM23CS001", subject_code="21MAT11", semester="1", status="F", total=32, max_marks=100)
        m_cse1_b = Mark(usn="1RM23CS001", subject_code="21MAT11", semester="2", status="P", total=60, max_marks=100)
        m_cse1_c = Mark(usn="1RM23CS001", subject_code="21CS32", semester="2", status="P", total=80, max_marks=100)

        # CSE Student 2: Active backlog in 21CS32
        st_cse2 = Student(usn="1RM23CS002", name="Bob", branch="CSE", total_backlogs=1)
        m_cse2_a = Mark(usn="1RM23CS002", subject_code="21MAT11", semester="1", status="P", total=70, max_marks=100)
        m_cse2_b = Mark(usn="1RM23CS002", subject_code="21CS32", semester="2", status="F", total=30, max_marks=100)

        # DS Student 1: Active backlogs in both 21MAT11 and 21CS32
        st_ds1 = Student(usn="1RM23DS001", name="Charlie", branch="DS", total_backlogs=2)
        m_ds1_a = Mark(usn="1RM23DS001", subject_code="21MAT11", semester="1", status="F", total=25, max_marks=100)
        m_ds1_b = Mark(usn="1RM23DS001", subject_code="21CS32", semester="2", status="F", total=28, max_marks=100)

        self.db.add_all([st_cse1, st_cse2, st_ds1, m_cse1_a, m_cse1_b, m_cse1_c, m_cse2_a, m_cse2_b, m_ds1_a, m_ds1_b])
        self.db.commit()

        students = [st_cse1, st_cse2, st_ds1]
        analytics = compute_backlog_analytics(students, self.db, limit_subjects=10)

        # 1. Total pending papers: 1 (Bob) + 2 (Charlie) = 3 pending papers
        self.assertEqual(analytics.total_failed_papers, 3)

        # 2. Overall deadliest subjects:
        # 21CS32: Bob failed (CSE), Charlie failed (DS) -> 2 fails out of 3 students (66.7%)
        # 21MAT11: Alice cleared (CSE), Bob passed (CSE), Charlie failed (DS) -> 1 fail out of 3 students (33.3%)
        deadliest_map = {s.subject_code: s for s in analytics.overall_deadliest_subjects}
        self.assertIn("21CS32", deadliest_map)
        self.assertIn("21MAT11", deadliest_map)
        self.assertEqual(deadliest_map["21CS32"].fail_count, 2)
        self.assertEqual(deadliest_map["21CS32"].pass_count, 1)
        self.assertEqual(deadliest_map["21CS32"].total_students, 3)

        self.assertEqual(deadliest_map["21MAT11"].fail_count, 1)
        self.assertEqual(deadliest_map["21MAT11"].pass_count, 2)
        self.assertEqual(deadliest_map["21MAT11"].total_students, 3)

        # 3. Branch summaries:
        branch_map = {b.branch: b for b in analytics.branches}
        # CSE: 2 students, total_backlogs = 1, clean_pass_students = 1, students_with_backlogs = 1
        cse_summary = branch_map["CSE"]
        self.assertEqual(cse_summary.total_students, 2)
        self.assertEqual(cse_summary.total_backlogs, 1)
        self.assertEqual(cse_summary.clean_pass_students, 1)
        self.assertEqual(cse_summary.students_with_backlogs, 1)
        self.assertEqual(cse_summary.avg_backlogs_per_student, 0.5)

        # DS: 1 student, total_backlogs = 2, clean_pass_students = 0, students_with_backlogs = 1
        ds_summary = branch_map["DS"]
        self.assertEqual(ds_summary.total_students, 1)
        self.assertEqual(ds_summary.total_backlogs, 2)
        self.assertEqual(ds_summary.clean_pass_students, 0)
        self.assertEqual(ds_summary.students_with_backlogs, 1)


if __name__ == "__main__":
    unittest.main()
