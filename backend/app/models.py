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

