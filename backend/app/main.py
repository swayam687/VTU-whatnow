import sys
from pathlib import Path

# Add backend directory to sys.path so 'app' can be imported anywhere
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from typing import List, Optional
from datetime import datetime, timezone
import hashlib
import secrets

def to_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Ensures datetime is explicitly marked with timezone UTC (+00:00) so client browsers accurately convert to local time."""
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()
from fastapi import FastAPI, Depends, HTTPException, Query, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, desc, func, distinct

from .config import settings
from .database import engine, get_db
from . import models
from .models import Student, Subject, Mark, SemesterLink, LoginLog, USNDispute, ComparisonLog, MissingUSNReport
from .schemas import (
    ScrapeRequest,
    CaptchaSubmit,
    AdminVerifyRequest,
    ScrapeStatus,
    StudentOut,
    StudentUpdate,
    BranchStats,
    SubjectBacklogStat,
    BranchBacklogSummary,
    BacklogAnalytics,
    SemesterLinkCreate,
    SemesterLinkOut,
    AuthStatusResponse,
    AuthLoginRequest,
    AuthResponse,
    DisputeCreateRequest,
    DisputeOut,
    DisputeReviewRequest,
    LoginLogOut,
    CompareLogCreate,
    CompareLogOut,
    StudentSessionVerifyResponse,
    MissingUSNReportCreate,
    MissingUSNReportOut,
    AvatarUpdateRequest,
)
from .services.job_manager import job_manager
from .scraper.worker import scraper_worker

from contextlib import asynccontextmanager
import threading

# -------------------------------------------------------------
# Cryptographic Password Hashing & Session Management
# Standard library PBKDF2-HMAC-SHA256 (0 dependencies, 100% free)
# -------------------------------------------------------------

def hash_password(password: str, salt: Optional[str] = None) -> str:
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    )
    return f"{salt}${key.hex()}"

def verify_password(password: str, stored_hash: Optional[str]) -> bool:
    if not stored_hash or "$" not in stored_hash:
        return False
    try:
        salt, key_hex = stored_hash.split("$", 1)
        computed = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            100000
        )
        return computed.hex() == key_hex
    except Exception:
        return False

# In-memory session store (token -> usn)
AUTH_SESSIONS: dict[str, str] = {}

def compute_pw_sig(usn: str, password_hash: str) -> str:
    """Computes a token signature tied directly to the current password_hash."""
    salt = settings.ADMIN_PASSWORD
    return hashlib.sha256(f"{usn.upper()}:{password_hash}:{salt}".encode("utf-8")).hexdigest()[:16]

def create_session(usn: str, password_hash: str) -> str:
    clean_usn = usn.strip().upper()
    pw_sig = compute_pw_sig(clean_usn, password_hash)
    token = f"{clean_usn}:{pw_sig}:{secrets.token_hex(16)}"
    AUTH_SESSIONS[token] = clean_usn
    return token

def verify_session_token(token: Optional[str], db: Session) -> Optional[str]:
    """
    Validates token format and verifies that its signature matches the student's CURRENT
    password_hash in the database. If a genuine owner transfers ownership via dispute approval,
    the old password_hash changes, instantly invalidating any previously issued tokens.
    """
    if not token or ":" not in token:
        return None
    parts = token.split(":")
    if len(parts) < 3:
        return None
    usn = parts[0].strip().upper()
    token_sig = parts[1]

    # Verify student exists and has claimed password
    student = db.query(Student).filter(Student.usn == usn).first()
    if not student or not student.password_hash or not student.is_claimed:
        AUTH_SESSIONS.pop(token, None)
        return None

    expected_sig = compute_pw_sig(usn, student.password_hash)
    if token_sig != expected_sig:
        # Password was changed or ownership transferred! Old user session is REVOKED.
        AUTH_SESSIONS.pop(token, None)
        return None

    AUTH_SESSIONS[token] = usn
    return usn

def get_current_student_usn(x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"), db: Session = Depends(get_db)) -> Optional[str]:
    return verify_session_token(x_student_token, db)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run DB table verification in a background thread so port binds immediately (<1s)
    def init_db():
        try:
            models.Base.metadata.create_all(bind=engine)
            # Safely add columns to existing students table in Supabase PostgreSQL & SQLite
            with engine.connect() as conn:
                for col_stmt in [
                    "ALTER TABLE students ADD COLUMN password_hash VARCHAR;",
                    "ALTER TABLE students ADD COLUMN is_claimed BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE students ADD COLUMN login_count INTEGER DEFAULT 0;",
                    "ALTER TABLE students ADD COLUMN last_login_at TIMESTAMP;",
                    "ALTER TABLE students ADD COLUMN avatar_pixel_art VARCHAR DEFAULT '';",
                ]:
                    try:
                        conn.execute(text(col_stmt))
                    except Exception:
                        pass

                # Explicitly guarantee comparison_logs table exists
                try:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS comparison_logs (
                            id SERIAL PRIMARY KEY,
                            viewer_usn VARCHAR,
                            viewer_name VARCHAR DEFAULT '',
                            student1_usn VARCHAR NOT NULL,
                            student1_name VARCHAR DEFAULT '',
                            student1_branch VARCHAR DEFAULT '',
                            student2_usn VARCHAR NOT NULL,
                            student2_name VARCHAR DEFAULT '',
                            student2_branch VARCHAR DEFAULT '',
                            compared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            ip_address VARCHAR DEFAULT ''
                        );
                    """))
                except Exception:
                    try:
                        conn.execute(text("""
                            CREATE TABLE IF NOT EXISTS comparison_logs (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                viewer_usn TEXT,
                                viewer_name TEXT DEFAULT '',
                                student1_usn TEXT NOT NULL,
                                student1_name TEXT DEFAULT '',
                                student1_branch TEXT DEFAULT '',
                                student2_usn TEXT NOT NULL,
                                student2_name TEXT DEFAULT '',
                                student2_branch TEXT DEFAULT '',
                                compared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                ip_address TEXT DEFAULT ''
                            );
                        """))
                    except Exception:
                        pass
                # Explicitly guarantee missing_usn_reports table exists
                try:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS missing_usn_reports (
                            id SERIAL PRIMARY KEY,
                            usn VARCHAR NOT NULL,
                            name VARCHAR DEFAULT '',
                            branch VARCHAR DEFAULT '',
                            message VARCHAR DEFAULT '',
                            status VARCHAR DEFAULT 'pending',
                            reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            ip_address VARCHAR DEFAULT ''
                        );
                    """))
                except Exception:
                    try:
                        conn.execute(text("""
                            CREATE TABLE IF NOT EXISTS missing_usn_reports (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                usn TEXT NOT NULL,
                                name TEXT DEFAULT '',
                                branch TEXT DEFAULT '',
                                message TEXT DEFAULT '',
                                status TEXT DEFAULT 'pending',
                                reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                ip_address TEXT DEFAULT ''
                            );
                        """))
                    except Exception:
                        pass
                conn.commit()
            print("✅ Database schema initialized/verified.")
        except Exception as e:
            print(f"⚠️ Notice: DB connection check ({e}). Web service remains live.")

    threading.Thread(target=init_db, daemon=True).start()
    yield

app = FastAPI(title="VTU WhatNow API", version="1.0.0", lifespan=lifespan)

# CORS setup
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "VTU WhatNow API",
        "status": "online",
        "docs": "/docs",
        "health": "/api/health"
    }


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "vtuwhatnow"}


# -------------------------------------------------------------
# Admin Authentication Helper
# -------------------------------------------------------------

def require_admin(x_admin_key: str = Header(default="", alias="X-Admin-Key")):
    if not x_admin_key or x_admin_key != settings.ADMIN_PASSWORD:
        raise HTTPException(
            status_code=401,
            detail="Admin authorization required. Please provide a valid admin password."
        )


@app.post("/api/admin/verify")
def verify_admin(req: AdminVerifyRequest):
    if req.password == settings.ADMIN_PASSWORD:
        return {"ok": True, "message": "Authenticated"}
    raise HTTPException(status_code=401, detail="Incorrect admin password.")


# -------------------------------------------------------------
# Student Authentication & USN Ownership Endpoints
# -------------------------------------------------------------

@app.get("/api/auth/status", response_model=AuthStatusResponse)
def get_auth_status(usn: str = Query(..., description="USN to check"), db: Session = Depends(get_db)):
    clean_usn = usn.strip().upper()
    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        return AuthStatusResponse(
            usn=clean_usn,
            exists=False,
            is_claimed=False,
            name="",
            branch="",
        )
    return AuthStatusResponse(
        usn=student.usn,
        exists=True,
        is_claimed=bool(student.is_claimed and student.password_hash),
        name=student.name,
        branch=student.branch,
    )


@app.post("/api/auth/login-or-register", response_model=AuthResponse)
def login_or_register(req: AuthLoginRequest, request: Request, db: Session = Depends(get_db)):
    clean_usn = req.usn.strip().upper()
    password = req.password.strip()

    if not clean_usn or not password:
        raise HTTPException(status_code=400, detail="USN and password are required.")

    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        raise HTTPException(
            status_code=404,
            detail=f"USN '{clean_usn}' not found in results database. Please ask admin to scrape your marks first."
        )

    client_ip = request.client.host if request.client else "unknown"

    # Case A: USN is Unclaimed -> Register and lock with this password
    if not student.is_claimed or not student.password_hash:
        student.password_hash = hash_password(password)
        student.is_claimed = True
        student.login_count = 1
        student.last_login_at = datetime.utcnow()

        log_entry = LoginLog(
            usn=student.usn,
            name=student.name,
            branch=student.branch,
            login_at=datetime.utcnow(),
            ip_address=client_ip,
        )
        db.add(log_entry)
        db.commit()

        token = create_session(student.usn, student.password_hash)
        return AuthResponse(
            ok=True,
            status="registered",
            token=token,
            usn=student.usn,
            name=student.name,
            branch=student.branch,
            login_count=1,
        )

    # Case B: USN is Already Claimed -> Verify Password
    if not verify_password(password, student.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect password for this USN. If someone else took your USN, click 'Claim Ownership' to verify with your selfie photo."
        )

    # Password matches -> Successful Login
    student.login_count = (student.login_count or 0) + 1
    student.last_login_at = datetime.utcnow()

    log_entry = LoginLog(
        usn=student.usn,
        name=student.name,
        branch=student.branch,
        login_at=datetime.utcnow(),
        ip_address=client_ip,
    )
    db.add(log_entry)
    db.commit()

    token = create_session(student.usn, student.password_hash)
    return AuthResponse(
        ok=True,
        status="authenticated",
        token=token,
        usn=student.usn,
        name=student.name,
        branch=student.branch,
        login_count=student.login_count,
    )


@app.get("/api/auth/verify-session", response_model=StudentSessionVerifyResponse)
def verify_student_session(
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db)
):
    usn = verify_session_token(x_student_token, db)
    if not usn:
        raise HTTPException(
            status_code=401,
            detail="Session has expired or USN ownership was updated. Please log in again."
        )
    student = db.query(Student).filter(Student.usn == usn).first()
    return StudentSessionVerifyResponse(
        valid=True,
        usn=student.usn,
        name=student.name,
        branch=student.branch,
        message="Active"
    )


@app.post("/api/auth/dispute")
def submit_usn_dispute(req: DisputeCreateRequest, db: Session = Depends(get_db)):
    clean_usn = req.usn.strip().upper()
    new_password = req.new_password.strip()

    if not clean_usn or not new_password or not req.selfie_base64:
        raise HTTPException(status_code=400, detail="USN, new password, and selfie photo are required.")

    if len(new_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    student = db.query(Student).filter(Student.usn == clean_usn).first()
    student_name = student.name if student else "Pending Scrape"
    student_branch = student.branch if student else "ENG"

    dispute = USNDispute(
        usn=clean_usn,
        name=student_name,
        branch=student_branch,
        selfie_base64=req.selfie_base64,
        new_password_hash=hash_password(new_password),
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)

    return {
        "ok": True,
        "message": f"Verification submitted for {clean_usn}! The admin will review your selfie and approve your ownership."
    }


# -------------------------------------------------------------
# Missing USN Reports & Notice
# -------------------------------------------------------------

@app.post("/api/missing-usn/report")
def report_missing_usn(
    req: MissingUSNReportCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    clean_usn = req.usn.strip().upper()
    if not clean_usn or len(clean_usn) < 4:
        raise HTTPException(status_code=400, detail="Please enter a valid USN.")

    client_ip = request.headers.get("x-forwarded-for")
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    entry = MissingUSNReport(
        usn=clean_usn,
        name=req.name.strip() if req.name else "",
        branch=req.branch.strip().upper() if req.branch else "",
        message=req.message.strip() if req.message else "Student reported USN not found in database.",
        status="pending",
        reported_at=datetime.utcnow(),
        ip_address=client_ip,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {
        "ok": True,
        "message": f"Report received for USN {clean_usn}! Admin has been notified to scrape and import your semester results.",
        "id": entry.id
    }


@app.get("/api/admin/missing-usn", dependencies=[Depends(require_admin)])
def get_admin_missing_usn_reports(db: Session = Depends(get_db)):
    reports = db.query(MissingUSNReport).order_by(desc(MissingUSNReport.reported_at)).limit(100).all()
    return [
        {
            "id": r.id,
            "usn": r.usn,
            "name": r.name,
            "branch": r.branch,
            "message": r.message,
            "status": r.status,
            "reported_at": to_utc_iso(r.reported_at),
            "ip_address": r.ip_address,
        }
        for r in reports
    ]


@app.post("/api/admin/missing-usn/{report_id}/resolve", dependencies=[Depends(require_admin)])
def resolve_missing_usn_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(MissingUSNReport).filter(MissingUSNReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    report.status = "resolved"
    db.commit()
    return {"ok": True, "message": f"Report for {report.usn} marked as resolved."}


@app.get("/api/admin/disputes", response_model=List[DisputeOut], dependencies=[Depends(require_admin)])
def get_admin_disputes(db: Session = Depends(get_db)):
    return db.query(USNDispute).order_by(desc(USNDispute.created_at)).limit(100).all()


@app.post("/api/admin/disputes/{dispute_id}/review", dependencies=[Depends(require_admin)])
def review_dispute(dispute_id: int, req: DisputeReviewRequest, db: Session = Depends(get_db)):
    dispute = db.query(USNDispute).filter(USNDispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute record not found.")

    if req.action == "approve":
        student = db.query(Student).filter(Student.usn == dispute.usn).first()
        if student:
            student.password_hash = dispute.new_password_hash
            student.is_claimed = True
            # Invalidate all active memory sessions for this USN to immediately kick out old user
            tokens_to_evict = [t for t, u in list(AUTH_SESSIONS.items()) if u == student.usn]
            for t in tokens_to_evict:
                AUTH_SESSIONS.pop(t, None)
        dispute.status = "approved"
        dispute.reviewed_at = datetime.utcnow()
        dispute.admin_notes = req.admin_notes or "Approved by admin after selfie verification."
        db.commit()
        return {
            "ok": True,
            "message": f"Ownership of {dispute.usn} transferred to real student! Previous imposter session was immediately kicked out."
        }
    elif req.action == "reject":
        dispute.status = "rejected"
        dispute.reviewed_at = datetime.utcnow()
        dispute.admin_notes = req.admin_notes or "Rejected by admin."
        db.commit()
        return {"ok": True, "message": f"Claim for {dispute.usn} was rejected."}
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'reject'.")


@app.get("/api/admin/login-logs", dependencies=[Depends(require_admin)])
def get_admin_login_logs(db: Session = Depends(get_db)):
    logs = db.query(LoginLog).order_by(desc(LoginLog.login_at)).limit(150).all()
    total_logins = db.query(LoginLog).count()

    from sqlalchemy import distinct, func
    unique_count = db.query(distinct(LoginLog.usn)).count()

    frequency = (
        db.query(
            LoginLog.usn,
            LoginLog.name,
            LoginLog.branch,
            func.count(LoginLog.id).label("count"),
            func.max(LoginLog.login_at).label("last_login")
        )
        .group_by(LoginLog.usn, LoginLog.name, LoginLog.branch)
        .order_by(desc("count"))
        .limit(50)
        .all()
    )

    freq_list = [
        {
            "usn": row[0],
            "name": row[1],
            "branch": row[2],
            "login_count": row[3],
            "last_login": to_utc_iso(row[4]),
        }
        for row in frequency
    ]

    return {
        "total_logins": total_logins,
        "unique_students": unique_count,
        "frequency": freq_list,
        "recent_logs": [
            {
                "id": l.id,
                "usn": l.usn,
                "name": l.name,
                "branch": l.branch,
                "login_at": to_utc_iso(l.login_at),
                "ip_address": l.ip_address,
            }
            for l in logs
        ]
    }


# -------------------------------------------------------------
# Scraper Endpoints
# -------------------------------------------------------------

@app.post("/api/scrape/start", dependencies=[Depends(require_admin)])
async def start_scraping(req: ScrapeRequest, db: Session = Depends(get_db)):
    if scraper_worker.is_active():
        raise HTTPException(status_code=400, detail="A scraping job is already running.")
    
    clean_start = req.start_usn.strip().upper()
    clean_end = req.end_usn.strip().upper() if req.end_usn else clean_start

    target_custom_url = req.custom_url
    target_sem = req.semester

    if req.semester_link_id:
        link = db.query(SemesterLink).filter(SemesterLink.id == req.semester_link_id).first()
        if link:
            target_custom_url = link.url
            if link.semester:
                target_sem = link.semester

    started = scraper_worker.start(
        start_usn=clean_start,
        end_usn=clean_end,
        semester=target_sem,
        custom_url=target_custom_url
    )
    if not started:
        raise HTTPException(status_code=400, detail="Failed to start scraping job.")
    return {
        "message": "Scraping started.",
        "start_usn": clean_start,
        "end_usn": clean_end,
        "portal_url": target_custom_url or "default"
    }


@app.post("/api/scrape/stop", dependencies=[Depends(require_admin)])
async def stop_scraping():
    scraper_worker.stop()
    return {"message": "Scraping stopped."}


# -------------------------------------------------------------
# Semester Links CRUD Endpoints
# -------------------------------------------------------------

@app.get("/api/semester-links", response_model=List[SemesterLinkOut])
def get_semester_links(db: Session = Depends(get_db)):
    try:
        links = db.query(SemesterLink).order_by(SemesterLink.id.asc()).all()
        if not links:
            # Auto-seed default semester links if table is empty
            default_1 = SemesterLink(
                title="Semester 1 & 2 (2022 Scheme - Jan/Feb 2026)",
                url=settings.VTU_URL_SEM1,
                semester="1",
                is_default=True
            )
            default_2 = SemesterLink(
                title="Semester 2 (2022 Scheme - June/July 2026)",
                url=settings.VTU_URL_SEM2,
                semester="2",
                is_default=False
            )
            db.add(default_1)
            db.add(default_2)
            db.commit()
            links = [default_1, default_2]
        return links
    except Exception as e:
        print(f"Error fetching semester links: {e}")
        return []


@app.post("/api/semester-links", response_model=SemesterLinkOut, dependencies=[Depends(require_admin)])
def create_semester_link(data: SemesterLinkCreate, db: Session = Depends(get_db)):
    clean_title = data.title.strip()
    clean_url = data.url.strip()
    if not clean_title or not clean_url:
        raise HTTPException(status_code=400, detail="Title and URL are required.")
    
    # VTU form entry is always index.php
    if "resultpage.php" in clean_url:
        clean_url = clean_url.replace("resultpage.php", "index.php")

    new_link = SemesterLink(
        title=clean_title,
        url=clean_url,
        semester=data.semester.strip() or "1",
        is_default=data.is_default,
    )
    db.add(new_link)
    db.commit()
    db.refresh(new_link)
    return new_link


@app.delete("/api/semester-links/{link_id}", dependencies=[Depends(require_admin)])
def delete_semester_link(link_id: int, db: Session = Depends(get_db)):
    link = db.query(SemesterLink).filter(SemesterLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Semester link not found.")
    title = link.title
    db.delete(link)
    db.commit()
    return {"message": f"Semester link '{title}' deleted successfully."}


# -------------------------------------------------------------
# System & Playwright Diagnostics
# -------------------------------------------------------------

@app.get("/api/system/browser-status")
def get_browser_status():
    """Checks whether Playwright Chromium is present and usable."""
    import os
    home = Path.home()
    possible_paths = [
        os.environ.get("PLAYWRIGHT_BROWSERS_PATH"),
        str(home / ".cache" / "ms-playwright"),
        "/opt/render/project/src/.cache/ms-playwright",
        str(home / "AppData" / "Local" / "ms-playwright"),
    ]
    detected_paths = [p for p in possible_paths if p and Path(p).exists()]
    return {
        "status": "ready" if detected_paths else "not_found",
        "detected_paths": detected_paths,
        "platform": sys.platform,
    }


@app.post("/api/system/install-browser", dependencies=[Depends(require_admin)])
def install_browser():
    """Triggers self-healing browser installation in the background."""
    import subprocess
    try:
        res = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            capture_output=True,
            text=True,
            timeout=120
        )
        if res.returncode == 0:
            return {"ok": True, "message": "Playwright Chromium verified and ready."}
        else:
            return {"ok": False, "message": res.stderr or "Installation failed"}
    except Exception as e:
        return {"ok": False, "message": str(e)}



@app.get("/api/scrape/status", response_model=ScrapeStatus)
async def get_scrape_status():
    return ScrapeStatus(
        is_running=job_manager.is_running,
        status=job_manager.status,
        message=job_manager.status_message,
        current_usn=job_manager.current_usn,
        start_usn=job_manager.start_usn,
        end_usn=job_manager.end_usn,
        processed_count=job_manager.processed_count,
        total_count=job_manager.total_count,
        captcha_base64=job_manager.captcha_base64,
        logs=job_manager.logs
    )


@app.post("/api/scrape/captcha", dependencies=[Depends(require_admin)])
async def submit_captcha(req: CaptchaSubmit):
    if job_manager.status != "waiting_captcha":
        raise HTTPException(status_code=400, detail="Scraper is not currently waiting for a captcha.")
    job_manager.provide_captcha(req.text)
    return {"message": "Captcha submitted."}


# -------------------------------------------------------------
# Student & Branch Query Endpoints
# -------------------------------------------------------------

@app.get("/api/students", response_model=List[StudentOut])
def get_students(
    branch: Optional[str] = Query(None, description="Filter by branch code, e.g. CSE, DS, ALL"),
    search: Optional[str] = Query("", description="Search by name or USN"),
    sort: Optional[str] = Query("percentage", description="Sort by: percentage, total_marks, usn, backlogs"),
    limit: Optional[int] = Query(100, ge=1, le=500),
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    response: Response = None,
    db: Session = Depends(get_db)
):
    current_usn = verify_session_token(x_student_token, db)
    is_authenticated = bool(current_usn)

    # If client supplied a student token that is no longer valid (e.g. ownership dispute approved)
    if x_student_token and not is_authenticated and response:
        response.headers["X-Token-Revoked"] = "true"
        response.headers["X-Is-Authenticated"] = "false"

    query = db.query(Student)

    if branch and branch.upper() != "ALL":
        query = query.filter(Student.branch == branch.upper())

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter((Student.name.ilike(term)) | (Student.usn.ilike(term)))

    if sort == "usn":
        query = query.order_by(Student.usn.asc())
    elif sort == "backlogs":
        query = query.order_by(Student.total_backlogs.asc(), Student.percentage.desc())
    elif sort == "recent":
        query = query.order_by(Student.updated_at.desc())
    else:
        query = query.order_by(Student.percentage.desc(), Student.total_marks.desc())

    # User rule:
    # Public visitors can only view Top 3 per branch and Top 5 campus-wide.
    # To view all students and personal rankings, student authentication is required.
    if not is_authenticated:
        if response:
            response.headers["X-Is-Authenticated"] = "false"
        if branch and branch.upper() != "ALL":
            return query.limit(3).all()
        else:
            return query.limit(5).all()

    if response:
        response.headers["X-Is-Authenticated"] = "true"
    students = query.limit(limit).all()
    return students


# -------------------------------------------------------------
# Comparison Logging & Audit Endpoints (Admin Only Visibility)
# -------------------------------------------------------------

@app.post("/api/compare/log")
def log_student_comparison(
    req: CompareLogCreate,
    request: Request,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db)
):
    # Rule: compare logs should appear ONLY if a logged-in user is trying to compare
    viewer_usn = verify_session_token(x_student_token, db) or req.viewer_usn
    if not viewer_usn or not viewer_usn.strip():
        return {"ok": False, "message": "Only logged-in user comparisons are recorded"}

    clean_viewer_usn = viewer_usn.strip().upper()
    viewer_name = (req.viewer_name or "").strip()
    viewer_student = db.query(Student).filter(Student.usn == clean_viewer_usn).first()
    if viewer_student and (not viewer_name or viewer_name == clean_viewer_usn):
        viewer_name = viewer_student.name

    # Client IP with header resolution
    client_ip = request.headers.get("x-forwarded-for")
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    # Fill student 1 and student 2 details if omitted
    s1_usn = req.student1_usn.strip().upper()
    s1_name = (req.student1_name or "").strip()
    s1_branch = (req.student1_branch or "").strip()
    if not s1_name or not s1_branch:
        st1 = db.query(Student).filter(Student.usn == s1_usn).first()
        if st1:
            s1_name = s1_name or st1.name
            s1_branch = s1_branch or st1.branch

    s2_usn = req.student2_usn.strip().upper()
    s2_name = (req.student2_name or "").strip()
    s2_branch = (req.student2_branch or "").strip()
    if not s2_name or not s2_branch:
        st2 = db.query(Student).filter(Student.usn == s2_usn).first()
        if st2:
            s2_name = s2_name or st2.name
            s2_branch = s2_branch or st2.branch

    entry = ComparisonLog(
        viewer_usn=clean_viewer_usn,
        viewer_name=viewer_name,
        student1_usn=s1_usn,
        student1_name=s1_name,
        student1_branch=s1_branch,
        student2_usn=s2_usn,
        student2_name=s2_name,
        student2_branch=s2_branch,
        compared_at=datetime.utcnow(),
        ip_address=client_ip,
    )
    db.add(entry)
    db.commit()
    return {"ok": True, "message": "Comparison event recorded"}


@app.get("/api/admin/compare-logs", dependencies=[Depends(require_admin)])
def get_admin_compare_logs(db: Session = Depends(get_db)):
    base_query = db.query(ComparisonLog).filter(
        ComparisonLog.viewer_usn.isnot(None),
        ComparisonLog.viewer_usn != ""
    )
    total_comparisons = base_query.count()
    recent = base_query.order_by(desc(ComparisonLog.compared_at)).limit(100).all()

    # Top compared against students
    top_targets = (
        db.query(
            ComparisonLog.student2_usn,
            ComparisonLog.student2_name,
            ComparisonLog.student2_branch,
            func.count(ComparisonLog.id).label("count")
        )
        .filter(ComparisonLog.viewer_usn.isnot(None), ComparisonLog.viewer_usn != "")
        .group_by(ComparisonLog.student2_usn, ComparisonLog.student2_name, ComparisonLog.student2_branch)
        .order_by(desc("count"))
        .limit(15)
        .all()
    )

    # Active viewers (which logged-in students are comparing most)
    active_viewers = (
        db.query(
            ComparisonLog.viewer_usn,
            ComparisonLog.viewer_name,
            func.count(ComparisonLog.id).label("count")
        )
        .filter(ComparisonLog.viewer_usn.isnot(None), ComparisonLog.viewer_usn != "")
        .group_by(ComparisonLog.viewer_usn, ComparisonLog.viewer_name)
        .order_by(desc("count"))
        .limit(15)
        .all()
    )

    return {
        "total_comparisons": total_comparisons,
        "recent_logs": [
            {
                "id": c.id,
                "viewer_usn": c.viewer_usn,
                "viewer_name": c.viewer_name,
                "student1_usn": c.student1_usn,
                "student1_name": c.student1_name,
                "student1_branch": c.student1_branch,
                "student2_usn": c.student2_usn,
                "student2_name": c.student2_name,
                "student2_branch": c.student2_branch,
                "compared_at": to_utc_iso(c.compared_at),
                "ip_address": c.ip_address,
            }
            for c in recent
        ],
        "top_targets": [
            {
                "usn": row[0],
                "name": row[1],
                "branch": row[2],
                "count": row[3],
            }
            for row in top_targets
        ],
        "active_viewers": [
            {
                "usn": row[0],
                "name": row[1],
                "count": row[2],
            }
            for row in active_viewers
        ],
    }


@app.get("/api/students/{usn}", response_model=StudentOut)
def get_student(usn: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.usn == usn.strip().upper()).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    return student


@app.patch("/api/students/{usn}", dependencies=[Depends(require_admin)])
def update_student_socials(usn: str, data: StudentUpdate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.usn == usn.strip().upper()).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    
    if data.github_url is not None:
        raw_github = data.github_url.strip()
        if raw_github and not raw_github.startswith("http://") and not raw_github.startswith("https://"):
            if "github.com/" in raw_github:
                raw_github = f"https://{raw_github}"
            else:
                raw_github = f"https://github.com/{raw_github.lstrip('@')}"
        student.github_url = raw_github

    if data.linkedin_url is not None:
        raw_linkedin = data.linkedin_url.strip()
        if raw_linkedin and not raw_linkedin.startswith("http://") and not raw_linkedin.startswith("https://"):
            if "linkedin.com/" in raw_linkedin:
                raw_linkedin = f"https://{raw_linkedin}"
            else:
                raw_linkedin = f"https://linkedin.com/in/{raw_linkedin.lstrip('@')}"
        student.linkedin_url = raw_linkedin
    
    db.commit()
    return {"message": "Social profiles updated successfully.", "student": student}


@app.post("/api/students/{usn}/avatar")
def update_student_avatar(
    usn: str,
    req: AvatarUpdateRequest,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db)
):
    clean_usn = usn.strip().upper()
    current_usn = verify_session_token(x_student_token, db)
    if not current_usn or current_usn != clean_usn:
        raise HTTPException(
            status_code=403,
            detail="Unauthorized: You can only customize the avatar of your own verified student account."
        )

    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    student.avatar_pixel_art = req.pixel_art.strip()
    db.commit()
    return {"ok": True, "message": "Custom avatar pixel art saved successfully!", "pixel_art": student.avatar_pixel_art}


@app.delete("/api/students/{usn}", dependencies=[Depends(require_admin)])
def delete_student(usn: str, db: Session = Depends(get_db)):
    clean_usn = usn.strip().upper()
    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    
    # Cascade delete marks
    db.query(Mark).filter(Mark.usn == clean_usn).delete()
    # Delete student record
    db.delete(student)
    db.commit()
    return {"message": f"Student {clean_usn} and associated marks deleted successfully."}


@app.get("/api/branches", response_model=List[BranchStats])
def get_branches(db: Session = Depends(get_db)):
    branches = db.query(Student.branch).distinct().all()
    results = []

    for (b,) in branches:
        if not b:
            continue
        students = db.query(Student).filter(Student.branch == b).all()
        total_students = len(students)
        avg_pct = round(sum(s.percentage for s in students) / total_students, 2) if total_students else 0.0
        total_backlogs = sum(s.total_backlogs for s in students)
        pass_count = sum(1 for s in students if s.total_backlogs == 0)

        results.append(BranchStats(
            branch=b,
            total_students=total_students,
            avg_percentage=avg_pct,
            total_backlogs=total_backlogs,
            pass_count=pass_count
        ))

    return results


@app.get("/api/leaderboard", response_model=List[StudentOut])
def get_leaderboard(
    branch: Optional[str] = Query(None, description="Branch filter or ALL"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    query = db.query(Student)
    if branch and branch.upper() != "ALL":
        query = query.filter(Student.branch == branch.upper())
    
    toppers = query.order_by(Student.percentage.desc(), Student.total_marks.desc()).limit(limit).all()
    return toppers


@app.get("/api/analytics/backlogs", response_model=BacklogAnalytics)
def get_backlog_analytics(db: Session = Depends(get_db)):
    """Computes branch-wise and subject-wise backlog mortality analytics."""
    students = db.query(Student).all()
    marks = db.query(Mark).all()
    subjects = {s.code: s.name for s in db.query(Subject).all()}
    student_branch_map = {s.usn: s.branch for s in students}

    total_failed_papers = sum(1 for m in marks if m.status in ("F", "A"))

    # 1. Overall subject statistics
    overall_subj_counts: dict = {}
    for m in marks:
        code = m.subject_code
        if code not in overall_subj_counts:
            overall_subj_counts[code] = {"total": 0, "fail": 0, "pass": 0}
        overall_subj_counts[code]["total"] += 1
        if m.status in ("F", "A"):
            overall_subj_counts[code]["fail"] += 1
        elif m.status == "P":
            overall_subj_counts[code]["pass"] += 1

    overall_deadliest: List[SubjectBacklogStat] = []
    for code, stats in overall_subj_counts.items():
        if stats["fail"] > 0:
            rate = round((stats["fail"] / stats["total"]) * 100, 1) if stats["total"] > 0 else 0.0
            overall_deadliest.append(SubjectBacklogStat(
                subject_code=code,
                subject_name=subjects.get(code, code),
                branch="ALL",
                total_students=stats["total"],
                fail_count=stats["fail"],
                pass_count=stats["pass"],
                fail_rate=rate,
            ))
    overall_deadliest.sort(key=lambda s: (s.fail_count, s.fail_rate), reverse=True)

    # 2. Branch-wise statistics
    branch_students_map: dict = {}
    for s in students:
        b = s.branch or "OTHER"
        if b not in branch_students_map:
            branch_students_map[b] = []
        branch_students_map[b].append(s)

    branch_marks_map: dict = {}
    for m in marks:
        b = student_branch_map.get(m.usn, "OTHER")
        if b not in branch_marks_map:
            branch_marks_map[b] = []
        branch_marks_map[b].append(m)

    branch_summaries: List[BranchBacklogSummary] = []
    for branch_name, b_students in branch_students_map.items():
        b_marks = branch_marks_map.get(branch_name, [])
        total_students = len(b_students)
        total_backlogs = sum(s.total_backlogs for s in b_students)
        avg_backlogs = round(total_backlogs / total_students, 2) if total_students > 0 else 0.0
        students_with_backlogs = sum(1 for s in b_students if s.total_backlogs > 0)
        clean_pass = sum(1 for s in b_students if s.total_backlogs == 0)

        # Branch subject stats
        b_subj_counts: dict = {}
        for m in b_marks:
            code = m.subject_code
            if code not in b_subj_counts:
                b_subj_counts[code] = {"total": 0, "fail": 0, "pass": 0}
            b_subj_counts[code]["total"] += 1
            if m.status in ("F", "A"):
                b_subj_counts[code]["fail"] += 1
            elif m.status == "P":
                b_subj_counts[code]["pass"] += 1

        b_deadliest: List[SubjectBacklogStat] = []
        for code, stats in b_subj_counts.items():
            if stats["fail"] > 0:
                rate = round((stats["fail"] / stats["total"]) * 100, 1) if stats["total"] > 0 else 0.0
                b_deadliest.append(SubjectBacklogStat(
                    subject_code=code,
                    subject_name=subjects.get(code, code),
                    branch=branch_name,
                    total_students=stats["total"],
                    fail_count=stats["fail"],
                    pass_count=stats["pass"],
                    fail_rate=rate,
                ))
        b_deadliest.sort(key=lambda s: (s.fail_count, s.fail_rate), reverse=True)

        branch_summaries.append(BranchBacklogSummary(
            branch=branch_name,
            total_students=total_students,
            total_backlogs=total_backlogs,
            avg_backlogs_per_student=avg_backlogs,
            students_with_backlogs=students_with_backlogs,
            clean_pass_students=clean_pass,
            top_failed_subjects=b_deadliest[:5],
        ))

    branch_summaries.sort(key=lambda b: b.total_backlogs, reverse=True)

    return BacklogAnalytics(
        total_failed_papers=total_failed_papers,
        overall_deadliest_subjects=overall_deadliest[:15],
        branches=branch_summaries,
    )
