from typing import List, Optional
from pydantic import BaseModel

class MarkBase(BaseModel):
    subject_code: str
    subject_name: str
    internal_marks: int
    external_marks: int
    total: int
    max_marks: int = 100
    status: str
    semester: str

class MarkOut(MarkBase):
    id: int
    class Config:
        from_attributes = True

class StudentBase(BaseModel):
    usn: str
    name: str
    branch: str
    batch: Optional[int] = None
    total_marks: int = 0
    max_marks: int = 0
    percentage: float = 0.0
    cgpa: float = 0.0
    total_backlogs: int = 0
    github_url: Optional[str] = ""
    linkedin_url: Optional[str] = ""

class StudentOut(StudentBase):
    marks: List[MarkOut] = []
    class Config:
        from_attributes = True

class StudentUpdate(BaseModel):
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None

class BranchStats(BaseModel):
    branch: str
    total_students: int
    avg_percentage: float
    total_backlogs: int
    pass_count: int
    students_with_backlogs: int = 0

class ScrapeRequest(BaseModel):
    start_usn: str
    end_usn: str
    semester: str = "1"
    custom_url: Optional[str] = None

class CaptchaSubmit(BaseModel):
    text: str

class AdminVerifyRequest(BaseModel):
    password: str

class ScrapeStatus(BaseModel):
    is_running: bool
    status: str
    message: str
    current_usn: Optional[str] = None
    start_usn: Optional[str] = None
    end_usn: Optional[str] = None
    processed_count: int = 0
    total_count: int = 0
    captcha_base64: Optional[str] = None
    logs: List[str] = []

