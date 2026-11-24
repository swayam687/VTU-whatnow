"""
Unit tests for VTU WhatNow credit calculations, grading, authentication, and session security.
Uses standard Python unittest (zero extra dependencies).
"""

import sys
import unittest
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.vtu_credits import (
    get_course_credit_info,
    get_vtu_grade,
    calculate_student_credits_and_gpa,
)
from app.auth import (
    hash_password,
    verify_password,
    compute_pw_sig,
    create_session,
)


class MockMark:
    def __init__(self, subject_code: str, semester: str, total: int, status: str = "P"):
        self.subject_code = subject_code
        self.semester = semester
        self.total = total
        self.status = status


class TestVTUCredits(unittest.TestCase):
    def test_credit_lookup_and_ncmc(self):
        # 4-credit maths course
        credits, is_ncmc, _ = get_course_credit_info("1BMAT101")
        self.assertEqual(credits, 4)
        self.assertFalse(is_ncmc)

        # 4-credit standard applied maths
        credits, is_ncmc, _ = get_course_credit_info("BMATE101")
        self.assertEqual(credits, 4)
        self.assertFalse(is_ncmc)

        # Non-Credit Mandatory Course (1BICO107 - Constitution & Ethics)
        credits, is_ncmc, _ = get_course_credit_info("1BICO107")
        self.assertEqual(credits, 0)
        self.assertTrue(is_ncmc)

    def test_vtu_grade_boundaries(self):
        # Grade O (90-100) -> 10 points
        grade, point = get_vtu_grade(95, "P")
        self.assertEqual(grade, "O")
        self.assertEqual(point, 10)

        # Grade A+ (80-89) -> 9 points
        grade, point = get_vtu_grade(85, "P")
        self.assertEqual(grade, "A+")
        self.assertEqual(point, 9)

        # Grade P (40-49) -> 4 points
        grade, point = get_vtu_grade(45, "P")
        self.assertEqual(grade, "P")
        self.assertEqual(point, 4)

        # Fail (<40) -> 0 points
        grade, point = get_vtu_grade(35, "P")
        self.assertEqual(grade, "F")
        self.assertEqual(point, 0)

        # Status 'F' regardless of marks -> Fail
        grade, point = get_vtu_grade(55, "F")
        self.assertEqual(grade, "F")
        self.assertEqual(point, 0)

        # NCMC passed course -> PP
        grade, point = get_vtu_grade(75, "P", is_ncmc=True)
        self.assertEqual(grade, "PP")
        self.assertEqual(point, 0)

    def test_sgpa_cgpa_calculation(self):
        # 1st semester with two 4-credit courses (90 marks = 10 pts, 80 marks = 9 pts)
        # plus one NCMC course (1BICO107, 70 marks)
        marks = [
            MockMark("1BMAT101", "1", 90, "P"),  # 4 credits * 10 = 40 pts
            MockMark("1BPHY102", "1", 80, "P"),  # 4 credits * 9 = 36 pts
            MockMark("1BICO107", "1", 70, "P"),  # 0 credits (NCMC) = 0 pts
        ]
        result = calculate_student_credits_and_gpa(marks)
        # Total academic credits = 4 + 4 = 8
        self.assertEqual(result["total_credits"], 8)
        self.assertEqual(result["credits_earned"], 8)
        # Expected SGPA = (40 + 36) / 8 = 76 / 8 = 9.5
        self.assertAlmostEqual(result["sgpa"], 9.5, places=2)
        self.assertAlmostEqual(result["semesters"]["1"]["sgpa"], 9.5, places=2)
        self.assertAlmostEqual(result["cgpa"], 9.5, places=2)


class TestAuthenticationSecurity(unittest.TestCase):
    def test_password_hashing_and_verification(self):
        password = "secret_password_123"
        stored_hash = hash_password(password)
        self.assertTrue(stored_hash.startswith("sha256") or "$" in stored_hash)
        self.assertTrue(verify_password(password, stored_hash))
        self.assertFalse(verify_password("wrong_password", stored_hash))

    def test_session_signature_revocation(self):
        usn = "1RM25CS001"
        pw_hash_v1 = hash_password("first_password")
        token = create_session(usn, pw_hash_v1)

        # Session token contains USN and signature tied to pw_hash_v1
        parts = token.split(":")
        self.assertEqual(len(parts), 3)
        self.assertEqual(parts[0], usn)
        sig = parts[1]
        self.assertEqual(sig, compute_pw_sig(usn, pw_hash_v1))

        # When password changes to pw_hash_v2, old token signature no longer matches
        pw_hash_v2 = hash_password("new_disputed_password")
        sig_v2 = compute_pw_sig(usn, pw_hash_v2)
        self.assertNotEqual(sig, sig_v2)


if __name__ == "__main__":
    unittest.main()
