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

class AdminMarkItem(BaseModel):
    subject_code: str
    subject_name: Optional[str] = ""
    semester: str = "1"
    internal_marks: int = 0
    external_marks: int = 0
    total: int = 0
    max_marks: int = 100
    status: str = "P"

class AdminMarksUpsertRequest(BaseModel):
    marks: List[AdminMarkItem]

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
    avatar_pixel_art: Optional[str] = ""
    show_my_backlogs: bool = True
    has_pending_subjects: Optional[str] = None
    is_my_profile: bool = False
    is_hidden: bool = False
    comparison_credits: int = 2

class PrivacySettingsUpdate(BaseModel):
    show_my_backlogs: Optional[bool] = None
    hidden: Optional[bool] = None

class PrivacySettingsOut(BaseModel):
    show_my_backlogs: bool = True
    hidden: bool = False

class AvatarUpdateRequest(BaseModel):
    pixel_art: str

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
    is_hidden: Optional[bool] = False

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

# ---------------- On-Demand Live Registration & Captcha ----------------
class OnDemandStartRequest(BaseModel):
    usn: str
    semester: Optional[str] = "1"
    semester_link_id: Optional[int] = None
    custom_url: Optional[str] = None

class OnDemandStartResponse(BaseModel):
    ok: bool
    session_id: Optional[str] = None
    captcha_base64: Optional[str] = None
    usn: str
    message: Optional[str] = None

class OnDemandRefreshRequest(BaseModel):
    session_id: str

class OnDemandRefreshResponse(BaseModel):
    ok: bool
    captcha_base64: Optional[str] = None
    message: Optional[str] = None

class OnDemandSubmitRequest(BaseModel):
    session_id: str
    captcha: str
    usn: str
    password: str

class OnDemandSubmitResponse(BaseModel):
    ok: bool
    status: Optional[str] = None
    token: Optional[str] = None
    usn: Optional[str] = None
    name: Optional[str] = None
    branch: Optional[str] = None
    login_count: Optional[int] = None
    total_marks: Optional[int] = None
    max_marks: Optional[int] = None
    percentage: Optional[float] = None
    reason: Optional[str] = None
    new_captcha_base64: Optional[str] = None
    message: Optional[str] = None

# ---------------- Crowdsourced Distributed Scraping Login Gate ----------------
class ScrapeTargetCreate(BaseModel):
    start_usn: str
    end_usn: str
    vtu_link: Optional[str] = None
    semester: str = "1"
    semester_link_id: Optional[int] = None

class ScrapeTargetOut(BaseModel):
    id: int
    start_usn: str
    end_usn: str
    vtu_link: str
    semester: str
    status: str
    current_usn_index: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class LoginGateChallengeResponse(BaseModel):
    ok: bool
    require_captcha: bool = False
    session_id: Optional[str] = None
    captcha_base64: Optional[str] = None
    message: Optional[str] = None
    auth_response: Optional[AuthResponse] = None

class LoginGateSubmitRequest(BaseModel):
    session_id: str
    captcha: str
    usn: str
    password: str

class LoginGateSubmitResponse(BaseModel):
    ok: bool
    require_captcha: bool = False
    bypassed: bool = False
    session_id: Optional[str] = None
    new_captcha_base64: Optional[str] = None
    fail_count: int = 0
    reason: Optional[str] = None
    message: Optional[str] = None
    auth_response: Optional[AuthResponse] = None

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

class MissingUSNReportCreate(BaseModel):
    usn: str
    name: Optional[str] = ""
    branch: Optional[str] = ""
    message: Optional[str] = ""

class MissingUSNReportOut(BaseModel):
    id: int
    usn: str
    name: str
    branch: str
    message: str
    status: str
    reported_at: Optional[str] = None
    ip_address: Optional[str] = ""

    class Config:
        from_attributes = True


class RescrapeRequestCreate(BaseModel):
    usn: str
    name: Optional[str] = ""
    branch: Optional[str] = ""
    request_type: str = "REVALUATION"  # "REVALUATION", "MISSING_SEMESTER", "RE_EXAM", "DATA_DELETION"
    target_semester: Optional[str] = "1"  # "1", "2", "all"
    subject_codes: Optional[str] = ""
    custom_url: Optional[str] = ""
    vtu_link: Optional[str] = None
    message: Optional[str] = ""


class RescrapeRequestOut(BaseModel):
    id: int
    usn: str
    name: str
    branch: str
    request_type: str
    target_semester: str
    subject_codes: Optional[str] = ""
    custom_url: Optional[str] = ""
    vtu_link: Optional[str] = ""
    message: str
    status: str
    created_at: Optional[str] = None
    resolved_at: Optional[str] = None
    admin_notes: Optional[str] = ""
    ip_address: Optional[str] = ""

    class Config:
        from_attributes = True


class RescrapeStatusResponse(BaseModel):
    has_pending: bool
    pending_request: Optional[RescrapeRequestOut] = None
    last_request: Optional[RescrapeRequestOut] = None


class RescrapeActionRequest(BaseModel):
    action: str  # "resolve", "reject", "scrape_now", "hide_student", "unhide_student"
    admin_notes: Optional[str] = ""


class StudentSemesterAudit(BaseModel):
    usn: str
    name: str
    branch: str
    batch: Optional[int] = None
    has_sem1: bool
    has_sem2: bool
    semesters_present: List[str]
    missing_semesters: List[str]
    total_marks: int
    max_marks: int
    percentage: float
    total_backlogs: int
    sem1_backlogs: int
    sem2_backlogs: int


class SemesterAuditResponse(BaseModel):
    total_students: int
    complete_both_sems: int
    missing_sem2: int
    missing_sem1: int
    no_marks: int
    students: List[StudentSemesterAudit]


class CompareCaptchaChallengeResponse(BaseModel):
    ok: bool = True
    session_id: str
    captcha_base64: str
    message: str = "To prevent automated abuse and keep comparisons running smoothly, please solve this captcha to continue."


class CompareCaptchaSubmitRequest(BaseModel):
    session_id: str
    captcha: str


class AdminCreditUpdateRequest(BaseModel):
    amount: Optional[int] = None
    set: Optional[int] = None


class SessionCancelRequest(BaseModel):
    session_id: str






