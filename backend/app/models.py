from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship, synonym
from .database import Base
from .services.subject_catalog import get_catalog_subject_name
from .services.vtu_credits import get_course_credit_info, get_vtu_grade

class Student(Base):
    __tablename__ = "students"

    usn = Column(String, primary_key=True, index=True)
    name = Column(String, index=True, default="")
    branch = Column(String, index=True, default="")
    batch = Column(Integer, index=True, nullable=True)
    total_marks = Column(Integer, default=0)
    max_marks = Column(Integer, default=0)
    percentage = Column(Float, default=0.0, index=True)
    cgpa = Column(Float, default=0.0, index=True)
    total_backlogs = Column(Integer, default=0, index=True)
    github_url = Column(String, nullable=True, default="")
    linkedin_url = Column(String, nullable=True, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Student Ownership & Authentication
    password_hash = Column(String, nullable=True)  # Nullable = Unclaimed
    is_claimed = Column(Boolean, default=False)
    login_count = Column(Integer, default=0)
    last_login_at = Column(DateTime, nullable=True)
    avatar_pixel_art = Column(String, nullable=True, default="")  # 10x10 custom pixel art matrix
    comparison_credits = Column(Integer, default=2, nullable=False)

    # Student Privacy Controls
    show_my_name = Column(Boolean, default=True)
    show_my_marks = Column(Boolean, default=True)
    show_my_backlogs = Column(Boolean, default=True)  # default on
    allow_comparison = Column(Boolean, default=True)
    is_hidden = Column(Boolean, default=False, index=True)  # Soft hide for data deletion requests / admin control
    hidden = synonym("is_hidden")

    marks = relationship("Mark", back_populates="student", cascade="all, delete-orphan", lazy="selectin", order_by="[Mark.semester, Mark.subject_code]")


class Subject(Base):
    __tablename__ = "subjects"

    code = Column(String, primary_key=True, index=True)
    name = Column(String, default="")

    marks = relationship("Mark", back_populates="subject")


class Mark(Base):
    __tablename__ = "marks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usn = Column(String, ForeignKey("students.usn"), index=True)
    subject_code = Column(String, ForeignKey("subjects.code"), index=True)
    semester = Column(String, default="1")
    internal_marks = Column(Integer, default=0)
    external_marks = Column(Integer, default=0)
    total = Column(Integer, default=0)
    max_marks = Column(Integer, default=100)
    status = Column(String, default="P")  # P (Pass), F (Fail), A (Absent), W (Withdrawn)

    student = relationship("Student", back_populates="marks")
    subject = relationship("Subject", back_populates="marks", lazy="joined")

    @property
    def subject_name(self) -> str:
        if self.subject and self.subject.name and self.subject.name.strip().upper() != (self.subject_code or "").strip().upper():
            return self.subject.name
        return get_catalog_subject_name(self.subject_code or "", self.subject.name if self.subject else None)

    @property
    def credits(self) -> int:
        return get_course_credit_info(self.subject_code or "")[0]

    @property
    def is_ncmc(self) -> bool:
        return get_course_credit_info(self.subject_code or "")[1]

    @property
    def grade(self) -> str:
        return get_vtu_grade(self.total or 0, self.status or "P", is_ncmc=self.is_ncmc)[0]

    @property
    def grade_point(self) -> int:
        return get_vtu_grade(self.total or 0, self.status or "P", is_ncmc=self.is_ncmc)[1]


class SemesterLink(Base):
    __tablename__ = "semester_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False, default="")
    url = Column(String, nullable=False, default="")
    semester = Column(String, default="1")
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class LoginLog(Base):
    __tablename__ = "login_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usn = Column(String, index=True, nullable=False)
    name = Column(String, default="")
    branch = Column(String, default="")
    login_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, nullable=True, default="")


class USNDispute(Base):
    __tablename__ = "usn_disputes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usn = Column(String, index=True, nullable=False)
    name = Column(String, default="")
    branch = Column(String, default="")
    selfie_base64 = Column(String, nullable=False)  # Base64 string of student selfie
    new_password_hash = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, approved, rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    admin_notes = Column(String, nullable=True, default="")


class ComparisonLog(Base):
    __tablename__ = "comparison_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    viewer_usn = Column(String, index=True, nullable=True)  # Who initiated comparison
    viewer_name = Column(String, default="")
    student1_usn = Column(String, index=True, nullable=False)
    student1_name = Column(String, default="")
    student1_branch = Column(String, default="")
    student2_usn = Column(String, index=True, nullable=False)
    student2_name = Column(String, default="")
    student2_branch = Column(String, default="")
    compared_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, nullable=True, default="")


class StudentViewLog(Base):
    __tablename__ = "student_view_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usn = Column(String, index=True, nullable=False)
    viewer_ip = Column(String, nullable=True)
    viewer_usn = Column(String, nullable=True)
    viewed_at = Column(DateTime, default=datetime.utcnow)


class MissingUSNReport(Base):
    __tablename__ = "missing_usn_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usn = Column(String, index=True, nullable=False)
    name = Column(String, default="")
    branch = Column(String, default="")
    message = Column(String, default="")
    status = Column(String, default="pending")  # "pending", "resolved", "rejected"
    reported_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, nullable=True, default="")


class RescrapeRequest(Base):
    __tablename__ = "rescrape_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usn = Column(String, index=True, nullable=False)
    name = Column(String, default="")
    branch = Column(String, default="")
    request_type = Column(String, nullable=False, default="REVALUATION")  # "REVALUATION", "MISSING_SEMESTER", "RE_EXAM", "CORRECTION"
    target_semester = Column(String, default="1")  # "1", "2", "all"
    subject_codes = Column(String, nullable=True, default="")  # e.g. "21MAT11, 21PHY12"
    custom_url = Column(String, nullable=True, default="")  # Student provided VTU results / reval link
    vtu_link = Column(String, nullable=True, default="")  # Specific reval/makeup results link
    message = Column(String, default="")
    status = Column(String, default="pending")  # "pending", "in_progress", "resolved", "rejected"
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    admin_notes = Column(String, nullable=True, default="")
    ip_address = Column(String, nullable=True, default="")


class ScrapeTarget(Base):
    """
    Admin-targeted USN range for distributed crowdsourced scraping.
    Students logging into the system will be assigned to solve captchas
    for USNs in this range sequentially.
    """
    __tablename__ = "scrape_targets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    start_usn = Column(String, nullable=False)
    end_usn = Column(String, nullable=False)
    vtu_link = Column(String, nullable=False)
    semester = Column(String, default="1")
    status = Column(String, default="PENDING")  # 'PENDING', 'COMPLETED'
    current_usn_index = Column(String, nullable=True)
    force_update = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class UserCaptchaLog(Base):
    """
    Tracks captchas solved by students during crowdsourced scraping (login gate or comparison gate).
    Prevents abuse and verifies target progression.
    """
    __tablename__ = "user_captcha_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_usn = Column(String, index=True, nullable=False)
    target_usn = Column(String, nullable=False)
    vtu_link = Column(String, nullable=True, default="")
    action = Column(String, default="comparison")  # 'comparison', 'login_gate'
    solved_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, nullable=True, default="")


class Faculty(Base):
    __tablename__ = "faculty"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    faculty_id = Column(String(64), nullable=True, default="")
    password_hash = Column(String, nullable=False)
    name = Column(String, default="")
    department = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    def __init__(self, **kwargs):
        if "faculty_id" not in kwargs and "username" in kwargs:
            kwargs["faculty_id"] = kwargs["username"]
        super().__init__(**kwargs)


class FacultyLoginLog(Base):
    __tablename__ = "faculty_login_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    faculty_username = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, nullable=True, default="")


class FacultyComparisonLog(Base):
    __tablename__ = "faculty_comparison_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    faculty_username = Column(String, index=True, nullable=False)
    usn_a = Column(String, index=True, nullable=False)
    name_a = Column(String, default="")
    usn_b = Column(String, index=True, nullable=False)
    name_b = Column(String, default="")
    timestamp = Column(DateTime, default=datetime.utcnow)








