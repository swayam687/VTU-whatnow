from datetime import datetime
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

class SubjectBacklogStat(BaseModel):
    subject_code: str
    subject_name: str
    branch: Optional[str] = "ALL"
    total_students: int
    fail_count: int
    pass_count: int
    fail_rate: float

class BranchBacklogSummary(BaseModel):
    branch: str
    total_students: int
    total_backlogs: int
    avg_backlogs_per_student: float
    students_with_backlogs: int
    clean_pass_students: int
    top_failed_subjects: List[SubjectBacklogStat] = []

class BacklogAnalytics(BaseModel):
    total_failed_papers: int
    overall_deadliest_subjects: List[SubjectBacklogStat]
    branches: List[BranchBacklogSummary]

class SemesterLinkBase(BaseModel):
    title: str
    url: str
    semester: str = "1"
    is_default: bool = False

class SemesterLinkCreate(SemesterLinkBase):
    pass

class SemesterLinkOut(SemesterLinkBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ScrapeRequest(BaseModel):
    start_usn: str
    end_usn: str
    semester: str = "1"
    custom_url: Optional[str] = None
    semester_link_id: Optional[int] = None

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

# ---------------- Student Authentication & USN Ownership ----------------
class AuthStatusResponse(BaseModel):
    usn: str
    exists: bool
    is_claimed: bool
    name: Optional[str] = ""
    branch: Optional[str] = ""

class AuthLoginRequest(BaseModel):
    usn: str
    password: str

class AuthResponse(BaseModel):
    ok: bool
    status: str  # "registered" or "authenticated"
    token: str
    usn: str
    name: str
    branch: str
    login_count: int

class DisputeCreateRequest(BaseModel):
    usn: str
    new_password: str
    selfie_base64: str

class DisputeOut(BaseModel):
    id: int
    usn: str
    name: str
    branch: str
    selfie_base64: str
    status: str
    created_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    admin_notes: Optional[str] = ""

    class Config:
        from_attributes = True

class DisputeReviewRequest(BaseModel):
    action: str  # "approve" or "reject"
    admin_notes: Optional[str] = ""

class LoginLogOut(BaseModel):
    id: int
    usn: str
    name: str
    branch: str
    login_at: Optional[datetime] = None
    ip_address: Optional[str] = ""

    class Config:
        from_attributes = True

class StudentDirectoryResponse(BaseModel):
    is_authenticated: bool
    total_students: int
    students: List[StudentOut]
    my_usn: Optional[str] = None
    my_rank_overall: Optional[int] = None
    my_rank_branch: Optional[int] = None

class CompareLogCreate(BaseModel):
    viewer_usn: Optional[str] = None
    viewer_name: Optional[str] = ""
    student1_usn: str
    student1_name: Optional[str] = ""
    student1_branch: Optional[str] = ""
    student2_usn: str
    student2_name: Optional[str] = ""
    student2_branch: Optional[str] = ""

class CompareLogOut(BaseModel):
    id: int
    viewer_usn: Optional[str] = None
    viewer_name: Optional[str] = ""
    student1_usn: str
    student1_name: str
    student1_branch: str
    student2_usn: str
    student2_name: str
    student2_branch: str
    compared_at: Optional[datetime] = None
    ip_address: Optional[str] = ""

    class Config:
        from_attributes = True

class StudentSessionVerifyResponse(BaseModel):
    valid: bool
    usn: Optional[str] = None
    name: Optional[str] = None
    branch: Optional[str] = None
    message: Optional[str] = ""



