from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class Student(Base):
    __tablename__ = "students"

    usn = Column(String, primary_key=True, index=True)
    name = Column(String, index=True, default="")
    branch = Column(String, index=True, default="")
    batch = Column(Integer, index=True, nullable=True)
    total_marks = Column(Integer, default=0)
    max_marks = Column(Integer, default=0)
    percentage = Column(Float, default=0.0)
    cgpa = Column(Float, default=0.0)
    total_backlogs = Column(Integer, default=0)
    github_url = Column(String, nullable=True, default="")
    linkedin_url = Column(String, nullable=True, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Student Ownership & Authentication
    password_hash = Column(String, nullable=True)  # Nullable = Unclaimed
    is_claimed = Column(Boolean, default=False)
    login_count = Column(Integer, default=0)
    last_login_at = Column(DateTime, nullable=True)

    marks = relationship("Mark", back_populates="student", cascade="all, delete-orphan")


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
    subject = relationship("Subject", back_populates="marks")

    @property
    def subject_name(self) -> str:
        return self.subject.name if self.subject else ""


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


