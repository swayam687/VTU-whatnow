import sys
import os
import time
import secrets
import asyncio
from pathlib import Path

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

# Add backend directory to sys.path so 'app' can be imported anywhere
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta

def to_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Ensures datetime is explicitly marked with timezone UTC (+00:00) so client browsers accurately convert to local time."""
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()
import csv
import io
from fastapi import FastAPI, Depends, HTTPException, Query, Header, Request, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, desc, func, distinct, inspect

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .security import sanitize_text, sanitize_url, validate_and_sanitize_vtu_url
from .config import settings
from .database import engine, get_db
from .services.vtu_credits import calculate_student_credits_and_gpa
from . import models
from .models import (
    Student,
    Subject,
    Mark,
    SemesterLink,
    LoginLog,
    USNDispute,
    ComparisonLog,
    MissingUSNReport,
    RescrapeRequest,
    ScrapeTarget,
    UserCaptchaLog,
    Faculty,
    FacultyLoginLog,
    FacultyComparisonLog,
)

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
    CompareLogCreate,
    StudentSessionVerifyResponse,
    MissingUSNReportCreate,
    AvatarUpdateRequest,
    RescrapeRequestCreate,
    RescrapeStatusResponse,
    RescrapeActionRequest,
    StudentSemesterAudit,
    SemesterAuditResponse,
    PrivacySettingsUpdate,
    PrivacySettingsOut,
    AdminMarksUpsertRequest,
    OnDemandStartRequest,
    OnDemandStartResponse,
    OnDemandRefreshRequest,
    OnDemandRefreshResponse,
    OnDemandSubmitRequest,
    OnDemandSubmitResponse,
    ScrapeTargetCreate,
    ScrapeTargetOut,
    LoginGateChallengeResponse,
    LoginGateSubmitRequest,
    LoginGateSubmitResponse,
    CompareCaptchaChallengeResponse,
    CompareCaptchaSubmitRequest,
    AdminCreditUpdateRequest,
    SessionCancelRequest,
    SecureStatsRequest,
    SecureStatsResponse,
    FacultyLoginRequest,
    FacultyLoginResponse,
    FacultyInfo,
    FacultyAuditsResponse,
    FacultyLoginLogItem,
    FacultyComparisonLogItem,
    StudentPortalOption,
    StudentUpdateStartRequest,
    StudentUpdateStartResponse,
    StudentUpdateSubmitRequest,
    StudentUpdateSubmitResponse,
    StudentUpdateRefreshRequest,
    StudentUpdateRefreshResponse,
)
from .services.job_manager import job_manager
from .scraper.worker import scraper_worker
from .services.ondemand_scraper import ondemand_scraper
from .auth import (
    hash_password,
    verify_password,
    create_session,
    verify_session_token,
    create_faculty_jwt,
    verify_faculty_jwt,
    extract_token_from_header,
    get_current_faculty,
    get_optional_faculty,
)

from contextlib import asynccontextmanager

def init_db():
    try:
        # 1. Create missing tables registered in metadata
        models.Base.metadata.create_all(bind=engine)

        # 2. Inspect existing columns to prevent executing failing ALTER statements
        try:
            insp = inspect(engine)
            existing_tables = set(insp.get_table_names())
            if "students" in existing_tables:
                existing_cols = {c["name"] for c in insp.get_columns("students")}
                columns_to_ensure = [
                    ("password_hash", "ALTER TABLE students ADD COLUMN password_hash VARCHAR;"),
                    ("is_claimed", "ALTER TABLE students ADD COLUMN is_claimed BOOLEAN DEFAULT FALSE;"),
                    ("login_count", "ALTER TABLE students ADD COLUMN login_count INTEGER DEFAULT 0;"),
                    ("last_login_at", "ALTER TABLE students ADD COLUMN last_login_at TIMESTAMP;"),
                    ("avatar_pixel_art", "ALTER TABLE students ADD COLUMN avatar_pixel_art VARCHAR DEFAULT '';"),
                    ("show_my_name", "ALTER TABLE students ADD COLUMN show_my_name BOOLEAN DEFAULT TRUE;"),
                    ("show_my_marks", "ALTER TABLE students ADD COLUMN show_my_marks BOOLEAN DEFAULT TRUE;"),
                    ("show_my_backlogs", "ALTER TABLE students ADD COLUMN show_my_backlogs BOOLEAN DEFAULT TRUE;"),
                    ("allow_comparison", "ALTER TABLE students ADD COLUMN allow_comparison BOOLEAN DEFAULT TRUE;"),
                    ("is_hidden", "ALTER TABLE students ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;"),
                    ("comparison_credits", "ALTER TABLE students ADD COLUMN comparison_credits INTEGER DEFAULT 2;"),
                ]
                for col_name, sql_stmt in columns_to_ensure:
                    if col_name not in existing_cols:
                        try:
                            with engine.begin() as conn:
                                conn.execute(text(sql_stmt))
                            print(f"✅ Added column '{col_name}' to students table.")
                        except Exception as col_err:
                            print(f"⚠️ Could not add column '{col_name}': {col_err}")

            if "rescrape_requests" in existing_tables:
                rescrape_cols = {c["name"] for c in insp.get_columns("rescrape_requests")}
                if "vtu_link" not in rescrape_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text("ALTER TABLE rescrape_requests ADD COLUMN vtu_link VARCHAR DEFAULT '';"))
                        print("✅ Added column 'vtu_link' to rescrape_requests table.")
                    except Exception as col_err:
                        print(f"⚠️ Could not add column 'vtu_link': {col_err}")

            if "scrape_targets" in existing_tables:
                st_cols = {c["name"] for c in insp.get_columns("scrape_targets")}
                if "force_update" not in st_cols:
                    try:
                        with engine.begin() as conn:
                            if engine.dialect.name == "postgresql":
                                conn.execute(text("ALTER TABLE scrape_targets ADD COLUMN force_update BOOLEAN DEFAULT FALSE;"))
                            else:
                                conn.execute(text("ALTER TABLE scrape_targets ADD COLUMN force_update BOOLEAN DEFAULT 0;"))
                        print("✅ Added column 'force_update' to scrape_targets table.")
                    except Exception as col_err:
                        print(f"⚠️ Could not add column 'force_update': {col_err}")

            if "faculty" in existing_tables:
                fac_cols = {c["name"] for c in insp.get_columns("faculty")}
                if "username" not in fac_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text("ALTER TABLE faculty ADD COLUMN username VARCHAR;"))
                            if "faculty_id" in fac_cols:
                                conn.execute(text("UPDATE faculty SET username = faculty_id WHERE username IS NULL OR username = '';"))
                        print("✅ Added column 'username' to faculty table.")
                    except Exception as col_err:
                        print(f"⚠️ Could not add column 'username' to faculty: {col_err}")
                if "password_hash" not in fac_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text("ALTER TABLE faculty ADD COLUMN password_hash VARCHAR DEFAULT '';"))
                        print("✅ Added column 'password_hash' to faculty table.")
                    except Exception as col_err:
                        print(f"⚠️ Could not add column 'password_hash' to faculty: {col_err}")

            if "faculty_comparison_logs" in existing_tables:
                fcomp_cols = {c["name"] for c in insp.get_columns("faculty_comparison_logs")}
                for col in ["name_a", "name_b"]:
                    if col not in fcomp_cols:
                        try:
                            with engine.begin() as conn:
                                conn.execute(text(f"ALTER TABLE faculty_comparison_logs ADD COLUMN {col} VARCHAR DEFAULT '';"))
                            print(f"✅ Added column '{col}' to faculty_comparison_logs table.")
                        except Exception as col_err:
                            print(f"⚠️ Could not add column '{col}' to faculty_comparison_logs: {col_err}")

            # 3. For PostgreSQL (e.g. Supabase on Render), guarantee idempotency with IF NOT EXISTS
            if engine.dialect.name == "postgresql":
                for col_name, col_def in [
                    ("password_hash", "VARCHAR"),
                    ("is_claimed", "BOOLEAN DEFAULT FALSE"),
                    ("login_count", "INTEGER DEFAULT 0"),
                    ("last_login_at", "TIMESTAMP"),
                    ("avatar_pixel_art", "VARCHAR DEFAULT ''"),
                    ("show_my_name", "BOOLEAN DEFAULT TRUE"),
                    ("show_my_marks", "BOOLEAN DEFAULT TRUE"),
                    ("show_my_backlogs", "BOOLEAN DEFAULT TRUE"),
                    ("allow_comparison", "BOOLEAN DEFAULT TRUE"),
                    ("is_hidden", "BOOLEAN DEFAULT FALSE"),
                    ("comparison_credits", "INTEGER DEFAULT 2"),
                ]:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE students ADD COLUMN IF NOT EXISTS {col_name} {col_def};"))
                    except Exception:
                        pass
                try:
                    with engine.begin() as conn:
                        conn.execute(text("ALTER TABLE rescrape_requests ADD COLUMN IF NOT EXISTS vtu_link VARCHAR DEFAULT '';"))
                        conn.execute(text("ALTER TABLE scrape_targets ADD COLUMN IF NOT EXISTS force_update BOOLEAN DEFAULT FALSE;"))
                except Exception:
                    pass
        except Exception as insp_err:
            print(f"⚠️ Column inspection notice: {insp_err}")

        # 4. Explicitly guarantee auxiliary tables exist in their own dedicated transactions
        # comparison_logs
        try:
            with engine.begin() as conn:
                if engine.dialect.name == "postgresql":
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
                else:
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
        except Exception as e:
            print(f"⚠️ comparison_logs init notice: {e}")

        # missing_usn_reports
        try:
            with engine.begin() as conn:
                if engine.dialect.name == "postgresql":
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
                else:
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
        except Exception as e:
            print(f"⚠️ missing_usn_reports init notice: {e}")

        # rescrape_requests
        try:
            with engine.begin() as conn:
                if engine.dialect.name == "postgresql":
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS rescrape_requests (
                            id SERIAL PRIMARY KEY,
                            usn VARCHAR NOT NULL,
                            name VARCHAR DEFAULT '',
                            branch VARCHAR DEFAULT '',
                            request_type VARCHAR NOT NULL DEFAULT 'REVALUATION',
                            target_semester VARCHAR DEFAULT '1',
                            subject_codes VARCHAR DEFAULT '',
                            custom_url VARCHAR DEFAULT '',
                            message VARCHAR DEFAULT '',
                            status VARCHAR DEFAULT 'pending',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            resolved_at TIMESTAMP,
                            admin_notes VARCHAR DEFAULT '',
                            ip_address VARCHAR DEFAULT ''
                        );
                    """))
                else:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS rescrape_requests (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            usn TEXT NOT NULL,
                            name TEXT DEFAULT '',
                            branch TEXT DEFAULT '',
                            request_type TEXT NOT NULL DEFAULT 'REVALUATION',
                            target_semester TEXT DEFAULT '1',
                            subject_codes TEXT DEFAULT '',
                            custom_url TEXT DEFAULT '',
                            message TEXT DEFAULT '',
                            status TEXT DEFAULT 'pending',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            resolved_at TIMESTAMP,
                            admin_notes TEXT DEFAULT '',
                            ip_address TEXT DEFAULT ''
                        );
                    """))
        except Exception as e:
            print(f"⚠️ rescrape_requests init notice: {e}")

        # user_captcha_logs
        try:
            with engine.begin() as conn:
                if engine.dialect.name == "postgresql":
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS user_captcha_logs (
                            id SERIAL PRIMARY KEY,
                            user_usn VARCHAR NOT NULL,
                            target_usn VARCHAR NOT NULL,
                            vtu_link VARCHAR DEFAULT '',
                            action VARCHAR DEFAULT 'comparison',
                            solved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            ip_address VARCHAR DEFAULT ''
                        );
                    """))
                else:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS user_captcha_logs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_usn TEXT NOT NULL,
                            target_usn TEXT NOT NULL,
                            vtu_link TEXT DEFAULT '',
                            action TEXT DEFAULT 'comparison',
                            solved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            ip_address TEXT DEFAULT ''
                        );
                    """))
        except Exception as e:
            print(f"⚠️ user_captcha_logs init notice: {e}")

        # Auto-seed and auto-heal subjects catalog
        try:
            from .services.subject_catalog import VTU_SUBJECT_NAMES
            with Session(bind=engine) as db:
                for code, name in VTU_SUBJECT_NAMES.items():
                    subj = db.query(models.Subject).filter(models.Subject.code == code).first()
                    if not subj:
                        db.add(models.Subject(code=code, name=name))
                    elif not subj.name or subj.name.strip().upper() == code.strip().upper():
                        subj.name = name
                db.commit()
        except Exception as subj_err:
            print(f"⚠️ Subject catalog auto-heal notice: {subj_err}")

        # Auto-seed default faculty account if table empty
        try:
            with Session(bind=engine) as db:
                if db.query(models.Faculty).count() == 0:
                    default_fac = models.Faculty(
                        username="faculty",
                        password_hash=hash_password("faculty123"),
                        name="Prof. Sharma",
                        department="CSE"
                    )
                    db.add(default_fac)
                    db.commit()
                    print("✅ Created default faculty account: 'faculty' (pass: faculty123)")
        except Exception as fac_err:
            print(f"⚠️ faculty seed notice: {fac_err}")

        # Ensure performance indices for leaderboard, sorting, and privacy filters
        indices_to_ensure = [
            ("idx_students_percentage", "CREATE INDEX IF NOT EXISTS idx_students_percentage ON students (percentage);"),
            ("idx_students_cgpa", "CREATE INDEX IF NOT EXISTS idx_students_cgpa ON students (cgpa);"),
            ("idx_students_backlogs", "CREATE INDEX IF NOT EXISTS idx_students_backlogs ON students (total_backlogs);"),
            ("idx_students_hidden", "CREATE INDEX IF NOT EXISTS idx_students_hidden ON students (is_hidden);"),
        ]
        for idx_name, idx_stmt in indices_to_ensure:
            try:
                with engine.begin() as conn:
                    conn.execute(text(idx_stmt))
            except Exception:
                pass

        print("✅ Database schema initialized and verified.")
    except Exception as e:
        print(f"⚠️ Notice: DB connection check ({e}). Web service remains live.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Execute database schema check synchronously before accepting traffic
    init_db()

    # Periodic background task to purge abandoned verification sessions every 60s
    cleanup_stop_event = asyncio.Event()

    async def _periodic_cleanup():
        while not cleanup_stop_event.is_set():
            try:
                await asyncio.wait_for(cleanup_stop_event.wait(), timeout=60.0)
                break
            except asyncio.TimeoutError:
                try:
                    await ondemand_scraper.cleanup_expired_sessions()
                except Exception:
                    pass

    cleanup_task = asyncio.create_task(_periodic_cleanup())
    try:
        yield
    finally:
        cleanup_stop_event.set()
        cleanup_task.cancel()
        try:
            await cleanup_task
        except (asyncio.CancelledError, Exception):
            pass
        try:
            await ondemand_scraper.shutdown()
        except Exception as e:
            print(f"⚠️ Notice during ondemand_scraper shutdown: {e}")
        try:
            engine.dispose()
        except Exception:
            pass

app = FastAPI(title="VTU WhatNow API", version="1.0.0", lifespan=lifespan)

# Rate Limiter setup (SlowAPI)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS setup - safely allows localhost, 127.0.0.1, LAN IPs, and Vercel/production domains with credentials
raw_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
explicit_origins = [o for o in raw_origins if o != "*"]
if "https://vtu-whatnow.vercel.app" not in explicit_origins:
    explicit_origins.append("https://vtu-whatnow.vercel.app")

# Secure regex: allows any port on localhost, 127.0.0.1, private LAN IPs, and Vercel preview/production deployments
safe_origin_regex = r"^(https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?|https://.*\.vercel\.app)$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=explicit_origins,
    allow_origin_regex=safe_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# In-memory single-use verified captcha sessions for secure analytics (expires in 5 minutes)
verified_secure_stats_sessions: Dict[str, Dict[str, Any]] = {}

def _prune_expired_captcha_sessions():
    """Removes unconsumed captcha verification sessions older than 5 minutes to prevent memory leaks."""
    now = time.time()
    expired = [k for k, v in list(verified_secure_stats_sessions.items()) if now - v.get("solved_at", 0) > 300]
    for k in expired:
        verified_secure_stats_sessions.pop(k, None)


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
    if not x_admin_key or not secrets.compare_digest(x_admin_key, settings.ADMIN_PASSWORD):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Admin authorization required. Please provide a valid admin password."
        )


@app.post("/api/admin/verify")
@limiter.limit("5/minute")
def verify_admin(req: AdminVerifyRequest, request: Request):
    if req.password and secrets.compare_digest(req.password, settings.ADMIN_PASSWORD):
        return {"ok": True, "message": "Authenticated"}
    raise HTTPException(status_code=403, detail="Forbidden: Incorrect admin password.")


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
        is_hidden=bool(student.is_hidden),
    )


@app.post("/api/auth/login", response_model=LoginGateChallengeResponse)
@app.post("/api/auth/login-or-register", response_model=LoginGateChallengeResponse)
@limiter.limit("5/minute")
async def login_or_register(req: AuthLoginRequest, request: Request, db: Session = Depends(get_db)):
    clean_usn = req.usn.strip().upper()
    password = req.password.strip()

    if not clean_usn or not password:
        raise HTTPException(status_code=400, detail="USN and password are required.")

    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    client_ip = request.client.host if request.client else "unknown"
    student = db.query(Student).filter(func.upper(Student.usn) == clean_usn).first()

    # Step B (Check DB):
    # Case 1: USN is NOT in the database -> Initiate Self-Scrape job
    if not student:
        default_link = db.query(SemesterLink).filter(SemesterLink.is_default == True).first()
        target_url = (default_link.url if default_link and default_link.url else settings.VTU_URL_SEM1).strip()
        res = await ondemand_scraper.start_session(
            target_usn=clean_usn,
            semester="1",
            target_url=target_url,
            student_usn=clean_usn,
            is_self_scrape=True,
        )

        if res.get("server_busy"):
            return LoginGateChallengeResponse(
                ok=False,
                require_captcha=False,
                server_busy=True,
                retry_after=res.get("retry_after", 60),
                message=res.get("message") or "Service is under load. Server is currently serving 5 users. Please wait 1 minute.",
            )

        if not res or not res.get("ok"):
            raise HTTPException(
                status_code=503,
                detail=res.get("message") or "VTU examination servers are currently busy or slow. Please try again."
            )

        return LoginGateChallengeResponse(
            ok=False,
            require_captcha=True,
            session_id=res["session_id"],
            captcha_base64=res["captcha_base64"],
            message="Please solve this captcha to verify your session and update campus records.",
        )

    if student.is_hidden:
        raise HTTPException(
            status_code=403,
            detail="USN deleted, request admin to add this USN data again and send your selfie to verify that you are the owner of the USN."
        )

    # Privacy & Security (Step 4):
    # Verify password FIRST before triggering any scraping gate
    if student.is_claimed and student.password_hash:
        if not verify_password(password, student.password_hash):
            raise HTTPException(
                status_code=401,
                detail="Incorrect password for this USN. If someone else took your USN, click 'Claim Ownership' to verify with your selfie photo."
            )

    # If USN was unclaimed in DB, lock with new password
    if not student.is_claimed or not student.password_hash:
        student.password_hash = hash_password(password)
        student.is_claimed = True

    # Case 2: User IS in the database & password is verified.
    # Check if there is an active/pending ScrapeTarget in the crowdsourced queue:
    target_info = ondemand_scraper.get_next_scrape_target(db)

    # If NO crowdsource target queued by admin, verified students log in immediately!
    if not target_info:
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
        return LoginGateChallengeResponse(
            ok=True,
            require_captcha=False,
            status="authenticated",
            token=token,
            usn=student.usn,
            name=student.name,
            branch=student.branch,
            login_count=student.login_count,
            message="Authentication successful! Welcome back."
        )

    target, target_usn = target_info
    print(f"[LOGIN GATE] Initiating mandatory crowdsourced captcha for student {clean_usn} (target: {target_usn}, portal: {target.vtu_link})")

    target_portal = (target.vtu_link or settings.VTU_URL_SEM1).strip()
    res = await ondemand_scraper.start_session(
        target_usn=target_usn,
        semester=target.semester or "1",
        target_url=target_portal,
        student_usn=clean_usn,
        is_self_scrape=False,
        target_id=target.id,
    )

    if res and res.get("ok"):
        return LoginGateChallengeResponse(
            ok=False,
            require_captcha=True,
            session_id=res["session_id"],
            captcha_base64=res["captcha_base64"],
            message="Please solve this captcha to verify your session and update campus records.",
        )
    else:
        # Fallback: VTU examination servers did not provide a captcha in time or are busy.
        # Verified students must NEVER be blocked from accessing their account and marks!
        print(f"[LOGIN GATE] Target {target_usn} captcha fetch was unsuccessful. Bypassing gate and logging verified student {clean_usn} in directly.")
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
        return LoginGateChallengeResponse(
            ok=True,
            require_captcha=False,
            status="authenticated",
            token=token,
            usn=student.usn,
            name=student.name,
            branch=student.branch,
            login_count=student.login_count,
            message="Authentication successful! Welcome back."
        )


@app.post("/api/auth/gate/submit", response_model=LoginGateSubmitResponse)
@limiter.limit("5/minute")
async def submit_login_gate_captcha(
    req: LoginGateSubmitRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    clean_usn = req.usn.strip().upper()
    password = req.password.strip()

    if not clean_usn or not password:
        raise HTTPException(status_code=400, detail="USN and password are required.")
    if not req.captcha.strip():
        raise HTTPException(status_code=400, detail="Captcha code is required.")
    if not req.session_id:
        raise HTTPException(status_code=400, detail="session_id is required.")

    client_ip = request.client.host if request.client else "unknown"
    res = await ondemand_scraper.submit_captcha(
        session_id=req.session_id,
        captcha_code=req.captcha.strip(),
        password=password,
        client_ip=client_ip,
    )

    if res.get("bypassed"):
        return LoginGateSubmitResponse(
            ok=True,
            bypassed=True,
            fail_count=res.get("fail_count", 3),
            auth_response=res.get("auth_response"),
            message=res.get("message", "VTU servers are currently unresponsive. Logging you in with cached data."),
        )

    if not res.get("ok"):
        return LoginGateSubmitResponse(
            ok=False,
            require_captcha=True,
            session_id=req.session_id,
            new_captcha_base64=res.get("new_captcha_base64"),
            fail_count=res.get("fail_count", 0),
            reason=res.get("reason"),
            message=res.get("message", "Incorrect captcha code. Please try again."),
        )

    return LoginGateSubmitResponse(
        ok=True,
        require_captcha=False,
        auth_response=res.get("auth_response"),
        message=res.get("message", "Verification successful!"),
    )


# -------------------------------------------------------------
# Faculty Authentication & Elevated Portal Gate
# -------------------------------------------------------------

@app.post("/api/auth/faculty-login", response_model=FacultyLoginResponse)
@limiter.limit("5/minute")
async def faculty_login(
    req: FacultyLoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    clean_username = req.username.strip().lower()
    password = req.password.strip()

    if not clean_username or not password:
        raise HTTPException(status_code=400, detail="Faculty username and password are required.")

    faculty = db.query(Faculty).filter(func.lower(Faculty.username) == clean_username).first()
    if not faculty:
        raise HTTPException(status_code=401, detail="Invalid faculty username or password.")

    if not verify_password(password, faculty.password_hash):
        raise HTTPException(status_code=401, detail="Invalid faculty username or password.")

    client_ip = request.client.host if request.client else "unknown"

    # Stage 2: Captcha solution submitted
    if req.session_id and req.captcha_solution and req.captcha_solution.strip():
        res = await ondemand_scraper.submit_captcha(
            session_id=req.session_id,
            captcha_code=req.captcha_solution.strip(),
            password=password,
            client_ip=client_ip,
        )

        if not res.get("ok") and not res.get("bypassed"):
            return FacultyLoginResponse(
                ok=False,
                require_captcha=True,
                session_id=req.session_id,
                captcha_base64=res.get("new_captcha_base64"),
                message=res.get("message", "Incorrect captcha code. Please try again.")
            )

        # Captcha verified! Record faculty login log
        login_log = FacultyLoginLog(
            faculty_username=faculty.username,
            timestamp=datetime.utcnow(),
            ip_address=client_ip,
        )
        db.add(login_log)
        db.commit()

        token = create_faculty_jwt(faculty)
        return FacultyLoginResponse(
            ok=True,
            require_captcha=False,
            token=token,
            status="authenticated",
            faculty=FacultyInfo(
                username=faculty.username,
                name=faculty.name,
                department=faculty.department,
            ),
            message="Faculty security verification verified.",
        )

    # Stage 1: Check credentials and trigger crowdsourced VTU captcha challenge
    target_info = ondemand_scraper.get_next_scrape_target(db)
    if target_info:
        target, target_usn = target_info
        target_portal = (target.vtu_link or settings.VTU_URL_SEM1).strip()
        target_sem = target.semester or "1"
        target_id = target.id
    else:
        unscraped = db.query(Student).filter(~Student.marks.any(), Student.is_hidden == False).first()
        target_usn = unscraped.usn if unscraped else "1RM25CS001"
        target_link = db.query(SemesterLink).filter(SemesterLink.is_default == True).first()
        target_portal = (target_link.url if target_link and target_link.url else settings.VTU_URL_SEM1).strip()
        target_sem = "1"
        target_id = None

    res = await ondemand_scraper.start_session(
        target_usn=target_usn,
        semester=target_sem,
        target_url=target_portal,
        student_usn=faculty.username,
        is_self_scrape=False,
        target_id=target_id,
    )

    if res and res.get("ok"):
        return FacultyLoginResponse(
            ok=False,
            require_captcha=True,
            session_id=res["session_id"],
            captcha_base64=res["captcha_base64"],
            message="Faculty security verification: please solve this VTU captcha to verify session.",
        )
    else:
        # Fallback if VTU unreachable
        login_log = FacultyLoginLog(
            faculty_username=faculty.username,
            timestamp=datetime.utcnow(),
            ip_address=client_ip,
        )
        db.add(login_log)
        db.commit()

        token = create_faculty_jwt(faculty)
        return FacultyLoginResponse(
            ok=True,
            require_captcha=False,
            token=token,
            status="authenticated",
            faculty=FacultyInfo(
                username=faculty.username,
                name=faculty.name,
                department=faculty.department,
            ),
            message="Faculty authenticated successfully.",
        )



# -------------------------------------------------------------
# On-Demand Student Registration & Live VTU Captcha Extraction
# -------------------------------------------------------------

@app.post("/api/auth/on-demand/start", response_model=OnDemandStartResponse)
async def start_on_demand_registration(req: OnDemandStartRequest, db: Session = Depends(get_db)):
    clean_usn = req.usn.strip().upper()
    if not clean_usn or len(clean_usn) < 5:
        raise HTTPException(status_code=400, detail="Invalid USN format.")

    # Check if student exists in DB
    existing = db.query(Student).filter(Student.usn == clean_usn).first()
    if existing and existing.is_hidden:
        raise HTTPException(
            status_code=403,
            detail="USN deleted, request admin to add this USN data again and send your selfie to verify that you are the owner of the USN."
        )

    if existing and existing.is_claimed and existing.password_hash:
        raise HTTPException(
            status_code=400,
            detail="This USN is already registered. Please sign in directly using your password, or submit a claim if someone else claimed it."
        )

    # Determine target VTU portal link
    target_url = None
    if req.custom_url and req.custom_url.strip():
        target_url = req.custom_url.strip()
    elif req.semester_link_id:
        link = db.query(SemesterLink).filter(SemesterLink.id == req.semester_link_id).first()
        if link and link.url:
            target_url = link.url

    if not target_url:
        default_link = db.query(SemesterLink).filter(SemesterLink.is_default == True).first()
        if default_link and default_link.url:
            target_url = default_link.url
        else:
            first_link = db.query(SemesterLink).order_by(SemesterLink.id.asc()).first()
            if first_link and first_link.url:
                target_url = first_link.url
            else:
                target_url = settings.VTU_URL_SEM1

    semester = req.semester or "1"
    res = await ondemand_scraper.start_session(clean_usn, semester=semester, target_url=target_url)
    if res.get("server_busy"):
        return OnDemandStartResponse(
            ok=False,
            server_busy=True,
            retry_after=res.get("retry_after", 60),
            usn=clean_usn,
            message=res.get("message") or "Service is under load. Server is currently serving 5 users. Please wait 1 minute.",
        )
    if not res.get("ok"):
        raise HTTPException(status_code=502, detail=res.get("message", "Failed to connect to VTU portal."))

    return OnDemandStartResponse(
        ok=True,
        session_id=res["session_id"],
        captcha_base64=res["captcha_base64"],
        usn=clean_usn,
        message=res.get("message")
    )


@app.post("/api/auth/on-demand/refresh", response_model=OnDemandRefreshResponse)
async def refresh_on_demand_captcha(req: OnDemandRefreshRequest):
    if not req.session_id:
        raise HTTPException(status_code=400, detail="session_id is required.")
    res = await ondemand_scraper.refresh_captcha(req.session_id)
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("message", "Failed to refresh captcha."))
    return OnDemandRefreshResponse(
        ok=True,
        captcha_base64=res.get("captcha_base64"),
        message="New captcha loaded."
    )


@app.post("/api/auth/on-demand/cancel")
async def cancel_on_demand_captcha(req: SessionCancelRequest):
    if req.session_id:
        await ondemand_scraper.cancel_session(req.session_id)
    return {"ok": True, "message": "Verification session cancelled."}


@app.post("/api/auth/on-demand/submit", response_model=OnDemandSubmitResponse)
async def submit_on_demand_captcha(
    req: OnDemandSubmitRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    clean_usn = req.usn.strip().upper()
    password = req.password.strip()

    if not clean_usn or not password:
        raise HTTPException(status_code=400, detail="USN and password are required.")
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")
    if not req.captcha or not req.captcha.strip():
        raise HTTPException(status_code=400, detail="Captcha code is required.")
    if not req.session_id:
        raise HTTPException(status_code=400, detail="session_id is required.")

    client_ip = request.client.host if request.client else "unknown"
    res = await ondemand_scraper.submit_captcha(
        session_id=req.session_id,
        captcha_code=req.captcha.strip(),
        password=password,
        client_ip=client_ip
    )

    return OnDemandSubmitResponse(
        ok=bool(res.get("ok")),
        status=res.get("status"),
        token=res.get("token"),
        usn=res.get("usn"),
        name=res.get("name"),
        branch=res.get("branch"),
        login_count=res.get("login_count"),
        total_marks=res.get("total_marks"),
        max_marks=res.get("max_marks"),
        percentage=res.get("percentage"),
        reason=res.get("reason"),
        new_captcha_base64=res.get("new_captcha_base64"),
        message=res.get("message"),
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
            detail="Session has expired or USN has been hidden/deleted. Please log in again."
        )
    student = db.query(Student).filter(Student.usn == usn).first()
    if not student or student.is_hidden:
        raise HTTPException(
            status_code=401,
            detail="USN deleted, request admin to add this USN data again and send your selfie to verify that you are the owner of the USN."
        )
    return StudentSessionVerifyResponse(
        valid=True,
        usn=student.usn,
        name=student.name,
        branch=student.branch,
        message="Active"
    )


@app.post("/api/auth/dispute")
@limiter.limit("5/minute")
def submit_usn_dispute(req: DisputeCreateRequest, request: Request, db: Session = Depends(get_db)):
    clean_usn = req.usn.strip().upper()
    new_password = req.new_password.strip()

    if not clean_usn or not new_password or not req.selfie_base64:
        raise HTTPException(status_code=400, detail="USN, new password, and selfie photo are required.")

    if len(new_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    if len(req.selfie_base64) > 7_000_000:
        raise HTTPException(status_code=400, detail="Selfie photo payload exceeds maximum size limit (5MB).")

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
@limiter.limit("5/minute")
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
        name=sanitize_text(req.name, max_length=100) if req.name else "",
        branch=sanitize_text(req.branch, max_length=20).upper() if req.branch else "",
        message=sanitize_text(req.message, max_length=1000, allow_multiline=True) if req.message else "Student reported USN not found in database.",
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


# -------------------------------------------------------------
# Revaluation, Missing Semester & Re-scrape Requests
# -------------------------------------------------------------

def format_rescrape_out(r: RescrapeRequest) -> dict:
    return {
        "id": r.id,
        "usn": r.usn,
        "name": r.name or r.usn,
        "branch": r.branch or "",
        "request_type": r.request_type,
        "target_semester": r.target_semester,
        "subject_codes": r.subject_codes or "",
        "custom_url": r.custom_url or "",
        "vtu_link": getattr(r, "vtu_link", None) or r.custom_url or "",
        "message": r.message or "",
        "status": r.status,
        "created_at": to_utc_iso(r.created_at),
        "resolved_at": to_utc_iso(r.resolved_at) if r.resolved_at else None,
        "admin_notes": r.admin_notes or "",
        "ip_address": r.ip_address or "",
    }


@app.post("/api/rescrape/request")
@limiter.limit("5/minute")
def create_rescrape_request(
    req: RescrapeRequestCreate,
    request: Request,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db)
):
    clean_usn = req.usn.strip().upper()
    if not clean_usn or len(clean_usn) < 4:
        raise HTTPException(status_code=400, detail="Please enter a valid USN.")

    # 0. Account Holder Verification: Strictly only the logged-in student can request an update for their OWN account
    session_usn = verify_session_token(x_student_token, db)
    if not session_usn or session_usn.strip().upper() != clean_usn:
        raise HTTPException(
            status_code=403,
            detail=f"Access restricted: Only the verified account owner logged in with USN {clean_usn} can submit a re-scrape request for their own marksheet."
        )

    # 1. Anti-Spam Check: Prevent user from spamming; allow only one active pending/in-progress request per USN
    existing_active = db.query(RescrapeRequest).filter(
        RescrapeRequest.usn == clean_usn,
        RescrapeRequest.status.in_(["pending", "in_progress"])
    ).order_by(desc(RescrapeRequest.created_at)).first()

    if existing_active:
        if req.request_type == "DATA_DELETION":
            if existing_active.request_type == "DATA_DELETION":
                sub_date = existing_active.created_at.strftime("%d %b %Y, %I:%M %p") if existing_active.created_at else "recently"
                raise HTTPException(
                    status_code=400,
                    detail=f"A deletion request for USN {clean_usn} is already pending (submitted {sub_date}). The administrator will process it within 24 hours."
                )
            else:
                # Upgrade previous pending update request to DATA_DELETION
                existing_active.request_type = "DATA_DELETION"
                existing_active.status = "pending"
                existing_active.target_semester = "all"
                existing_active.message = sanitize_text(req.message, max_length=1000, allow_multiline=True) if req.message else "Data deletion requested."
                existing_active.created_at = datetime.utcnow()
                db.commit()
                db.refresh(existing_active)
                return {
                    "ok": True,
                    "message": "Deletion request sent to admin. Your data will be deleted in 24 hours.",
                    "id": existing_active.id,
                    "request": format_rescrape_out(existing_active)
                }
        else:
            sub_date = existing_active.created_at.strftime("%d %b %Y, %I:%M %p") if existing_active.created_at else "recently"
            raise HTTPException(
                status_code=400,
                detail=f"A request for USN {clean_usn} is already in the queue (submitted {sub_date}). The admin has been notified and will review your update soon!"
            )

    # 2. Rate limit by client IP (max 5 requests per day)
    client_ip = request.headers.get("x-forwarded-for")
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    one_day_ago = datetime.utcnow() - timedelta(days=1)
    recent_ip_count = db.query(RescrapeRequest).filter(
        RescrapeRequest.ip_address == client_ip,
        RescrapeRequest.created_at >= one_day_ago
    ).count()

    if recent_ip_count >= 5:
        raise HTTPException(
            status_code=429,
            detail="Rate limit reached for your network: maximum 5 requests per 24 hours. Please wait before submitting again."
        )

    # Lookup student record to autofill name & branch if not provided
    student = db.query(Student).filter(Student.usn == clean_usn).first()
    student_name = sanitize_text(req.name, max_length=100) if req.name else (student.name if student else clean_usn)
    student_branch = sanitize_text(req.branch, max_length=20).upper() if req.branch else (student.branch if student else "")
    clean_msg = sanitize_text(req.message, max_length=1000, allow_multiline=True) if req.message else ""
    clean_codes = sanitize_text(req.subject_codes, max_length=200) if req.subject_codes else ""

    vtu_link_raw = (req.vtu_link or req.custom_url or "").strip()
    vtu_link_val = validate_and_sanitize_vtu_url(vtu_link_raw)

    entry = RescrapeRequest(
        usn=clean_usn,
        name=student_name,
        branch=student_branch,
        request_type=req.request_type,
        target_semester=req.target_semester or "1",
        subject_codes=clean_codes,
        custom_url=vtu_link_val,
        vtu_link=vtu_link_val,
        message=req.message.strip() if req.message else "",
        status="pending",
        created_at=datetime.utcnow(),
        ip_address=client_ip,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    resp_msg = (
        "Deletion request sent to admin. Your data will be deleted in 24 hours."
        if req.request_type == "DATA_DELETION"
        else f"Update request sent! Admin has been notified to refresh results for USN {clean_usn}."
    )

    return {
        "ok": True,
        "message": resp_msg,
        "id": entry.id,
        "request": format_rescrape_out(entry)
    }


@app.get("/api/rescrape/status", response_model=RescrapeStatusResponse)
def get_rescrape_status(usn: str = Query(...), db: Session = Depends(get_db)):
    clean_usn = usn.strip().upper()
    pending = db.query(RescrapeRequest).filter(
        RescrapeRequest.usn == clean_usn,
        RescrapeRequest.status.in_(["pending", "in_progress"])
    ).order_by(desc(RescrapeRequest.created_at)).first()

    last = db.query(RescrapeRequest).filter(
        RescrapeRequest.usn == clean_usn
    ).order_by(desc(RescrapeRequest.created_at)).first()

    return {
        "has_pending": bool(pending),
        "pending_request": format_rescrape_out(pending) if pending else None,
        "last_request": format_rescrape_out(last) if last else None
    }


@app.get("/api/admin/rescrape-requests", dependencies=[Depends(require_admin)])
def get_admin_rescrape_requests(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(RescrapeRequest)
    if status and status != "all":
        query = query.filter(RescrapeRequest.status == status)
    requests = query.order_by(desc(RescrapeRequest.created_at)).limit(150).all()
    return [format_rescrape_out(r) for r in requests]


@app.post("/api/admin/rescrape-requests/{request_id}/action", dependencies=[Depends(require_admin)])
def handle_admin_rescrape_action(
    request_id: int,
    req: RescrapeActionRequest,
    db: Session = Depends(get_db)
):
    item = db.query(RescrapeRequest).filter(RescrapeRequest.id == request_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Request not found.")

    if req.action == "resolve":
        item.status = "resolved"
        item.resolved_at = datetime.utcnow()
        if req.admin_notes:
            item.admin_notes = req.admin_notes
        db.commit()
        return {"ok": True, "message": f"Request for {item.usn} marked as resolved."}

    elif req.action == "reject":
        item.status = "rejected"
        item.resolved_at = datetime.utcnow()
        if req.admin_notes:
            item.admin_notes = req.admin_notes
        db.commit()
        return {"ok": True, "message": f"Request for {item.usn} marked as rejected."}

    elif req.action == "scrape_now":
        if scraper_worker.is_active():
            raise HTTPException(status_code=400, detail="Scraper is currently running another job. Please wait for it to complete.")

        if item.target_semester == "both":
            # If student already has Sem 1 in DB, scrape Sem 2; otherwise scrape Sem 1
            has_sem1 = db.query(Mark).filter(Mark.usn == item.usn, Mark.semester == "1").first() is not None
            target_sem = "2" if has_sem1 else "1"
        elif item.target_semester in ("1", "2"):
            target_sem = item.target_semester
        else:
            target_sem = "1"
        custom_url = (item.vtu_link or item.custom_url or "").strip() or None

        started = scraper_worker.start(
            start_usn=item.usn,
            end_usn=item.usn,
            semester=target_sem,
            custom_url=custom_url
        )
        if not started:
            raise HTTPException(status_code=400, detail="Could not initiate scraper worker.")

        item.status = "in_progress"
        db.commit()
        return {
            "ok": True,
            "message": f"Launched scraper for {item.usn} (Sem {target_sem})! Monitor progress in the Scraper tab."
        }

    elif req.action == "queue_crowdsource":
        target_url = (item.vtu_link or item.custom_url or "").strip()
        if not target_url:
            default_link = db.query(SemesterLink).filter(SemesterLink.is_default == True).first()
            target_url = default_link.url if default_link else settings.VTU_URL_SEM1

        target_sem = item.target_semester if item.target_semester in ("1", "2") else "1"

        new_target = ScrapeTarget(
            start_usn=item.usn.strip().upper(),
            end_usn=item.usn.strip().upper(),
            vtu_link=target_url,
            semester=target_sem,
            status="PENDING",
            current_usn_index=item.usn.strip().upper(),
            force_update=True,
        )
        db.add(new_target)
        item.status = "in_progress"
        item.admin_notes = req.admin_notes or f"Queued for crowdsourced verification (force_update=True) on {target_url}"
        db.commit()
        return {
            "ok": True,
            "message": f"USN {item.usn} queued in Crowdsourced Gate with Force Update enabled! Next logging-in student will solve this captcha."
        }

    elif req.action == "hide_student":
        student = db.query(Student).filter(Student.usn == item.usn).first()
        if student:
            student.is_hidden = True
        item.status = "resolved"
        item.resolved_at = datetime.utcnow()
        item.admin_notes = req.admin_notes or "Profile hidden from public view per data deletion request."
        db.commit()
        return {"ok": True, "message": f"Student {item.usn} profile has been hidden from public views and active sessions revoked."}

    elif req.action == "unhide_student":
        student = db.query(Student).filter(Student.usn == item.usn).first()
        if student:
            student.is_hidden = False
        db.commit()
        return {"ok": True, "message": f"Student {item.usn} profile is now visible in public views."}

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}")


@app.patch("/api/admin/students/{usn}/visibility", dependencies=[Depends(require_admin)])
def toggle_student_visibility(
    usn: str,
    hidden: bool = Query(..., description="Whether to hide the student profile from public views"),
    db: Session = Depends(get_db)
):
    clean_usn = usn.strip().upper()
    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    student.is_hidden = hidden
    db.commit()
    return {
        "ok": True,
        "usn": clean_usn,
        "is_hidden": student.is_hidden,
        "message": f"Student {clean_usn} is now {'hidden from' if hidden else 'restored/visible in'} public views."
    }


@app.get("/api/admin/semester-audit", response_model=SemesterAuditResponse, dependencies=[Depends(require_admin)])
def get_admin_semester_audit(db: Session = Depends(get_db)):
    students = db.query(Student).order_by(Student.usn).all()
    audit_list = []
    complete_both = 0
    missing_sem2 = 0
    missing_sem1 = 0
    no_marks = 0

    for s in students:
        sems = {m.semester for m in s.marks}
        has_sem1 = "1" in sems
        has_sem2 = "2" in sems

        unique_sems = sorted(list(sems))
        missing = []
        if not has_sem1:
            missing.append("1")
        if not has_sem2:
            missing.append("2")

        if has_sem1 and has_sem2:
            complete_both += 1
        elif has_sem1 and not has_sem2:
            missing_sem2 += 1
        elif has_sem2 and not has_sem1:
            missing_sem1 += 1
        else:
            no_marks += 1

        sem1_bl = sum(1 for m in s.marks if m.semester == "1" and m.status in ("F", "A"))
        sem2_bl = sum(1 for m in s.marks if m.semester == "2" and m.status in ("F", "A"))

        audit_list.append(StudentSemesterAudit(
            usn=s.usn,
            name=s.name or s.usn,
            branch=s.branch,
            batch=s.batch,
            has_sem1=has_sem1,
            has_sem2=has_sem2,
            semesters_present=unique_sems,
            missing_semesters=missing,
            total_marks=s.total_marks,
            max_marks=s.max_marks,
            percentage=s.percentage,
            total_backlogs=s.total_backlogs,
            sem1_backlogs=sem1_bl,
            sem2_backlogs=sem2_bl,
        ))

    return SemesterAuditResponse(
        total_students=len(students),
        complete_both_sems=complete_both,
        missing_sem2=missing_sem2,
        missing_sem1=missing_sem1,
        no_marks=no_marks,
        students=audit_list
    )


@app.post("/api/admin/recalculate-cumulative-totals", dependencies=[Depends(require_admin)])
def recalculate_cumulative_totals(
    usn: Optional[str] = Query(None, description="Optional single USN to recalculate, or omit for all students"),
    db: Session = Depends(get_db)
):
    """
    Recalculates cumulative degree totals, percentages, and backlogs from scratch
    using the distinct-subject deduplication algorithm across all available semesters in the database.
    Fixes legacy records where multi-semester max_marks were frozen at 800/900.
    """
    query = db.query(Student)
    if usn:
        query = query.filter(Student.usn == usn.strip().upper())
    students = query.all()

    updated_count = 0
    for student in students:
        all_marks = db.query(Mark).filter(Mark.usn == student.usn).all()
        if not all_marks:
            continue

        effective_subjects = {}
        for m in all_marks:
            code = m.subject_code.strip().upper()
            if code not in effective_subjects:
                effective_subjects[code] = m
            else:
                existing = effective_subjects[code]
                if m.status == "P" and existing.status != "P":
                    effective_subjects[code] = m
                elif m.status == "P" and existing.status == "P" and m.total > existing.total:
                    effective_subjects[code] = m
                elif m.status != "P" and existing.status != "P" and m.total > existing.total:
                    effective_subjects[code] = m

        final_marks = list(effective_subjects.values())
        student.total_marks = sum(m.total for m in final_marks)
        student.max_marks = sum(m.max_marks for m in final_marks)
        student.total_backlogs = sum(1 for m in final_marks if m.status in ("F", "A"))
        student.percentage = round((student.total_marks / student.max_marks * 100), 2) if student.max_marks > 0 else 0.0
        updated_count += 1

    db.commit()
    return {
        "ok": True,
        "message": f"Successfully recalculated cumulative totals for {updated_count} students.",
        "updated_count": updated_count
    }



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
            student.is_hidden = False  # Restores/unhides the USN data for the verified owner!
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


def _prune_stale_audit_logs(db: Session, max_days: int = 2):
    """Automatically removes audit and tracking logs older than 2 days to maintain privacy and prevent unbounded DB growth."""
    try:
        cutoff = datetime.utcnow() - timedelta(days=max_days)
        db.query(LoginLog).filter(LoginLog.login_at < cutoff).delete(synchronize_session=False)
        db.query(ComparisonLog).filter(ComparisonLog.compared_at < cutoff).delete(synchronize_session=False)
        db.query(UserCaptchaLog).filter(UserCaptchaLog.created_at < cutoff).delete(synchronize_session=False)
        db.query(FacultyLoginLog).filter(FacultyLoginLog.login_at < cutoff).delete(synchronize_session=False)
        db.query(FacultyComparisonLog).filter(FacultyComparisonLog.compared_at < cutoff).delete(synchronize_session=False)
        db.commit()
    except Exception as e:
        print(f"⚠️ Notice during stale audit logs cleanup: {e}")


@app.get("/api/admin/login-logs", dependencies=[Depends(require_admin)])
def get_admin_login_logs(db: Session = Depends(get_db)):
    _prune_stale_audit_logs(db, max_days=2)
    logs = db.query(LoginLog).order_by(desc(LoginLog.login_at)).limit(150).all()
    total_logins = db.query(LoginLog).count()

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
            default_3 = SemesterLink(
                title="UG Summer / Makeup Exam 2026 (SME26cbcs)",
                url=settings.VTU_URL_MAKEUP,
                semester="2",
                is_default=False
            )
            db.add(default_1)
            db.add(default_2)
            db.add(default_3)
            db.commit()
            links = [default_1, default_2, default_3]
        return links
    except Exception as e:
        print(f"Error fetching semester links: {e}")
        return []


@app.get("/api/student/available-portals", response_model=List[StudentPortalOption])
def get_student_available_portals(db: Session = Depends(get_db)):
    """Returns available examination portals with headings and semester tags, keeping raw URLs hidden."""
    links = get_semester_links(db)
    return [
        StudentPortalOption(
            id=link.id,
            title=link.title,
            semester=link.semester or "1",
            is_default=bool(link.is_default),
        )
        for link in links
    ]


@app.post("/api/student/update-record/start", response_model=StudentUpdateStartResponse)
async def start_student_record_update(
    req: StudentUpdateStartRequest,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db)
):
    current_usn = verify_session_token(x_student_token, db)
    if not current_usn:
        raise HTTPException(status_code=401, detail="Authentication required to update your record.")

    action_type = req.action_type or "UPDATE_RECORD"
    heading = ""

    if action_type == "UPDATE_RECORD":
        link = None
        if req.semester_link_id:
            link = db.query(SemesterLink).filter(SemesterLink.id == req.semester_link_id).first()
        if not link:
            link = db.query(SemesterLink).order_by(SemesterLink.is_default.desc(), SemesterLink.id.asc()).first()
        if not link:
            raise HTTPException(status_code=404, detail="No examination portal links have been configured by the administrator.")

        target_url = (link.url if link.url else settings.VTU_URL_SEM1).strip()
        target_sem = link.semester.strip() if link.semester else "1"
        heading = link.title

        res = await ondemand_scraper.start_session(
            target_usn=current_usn,
            semester=target_sem,
            target_url=target_url,
            is_self_scrape=True
        )
    else:
        # action_type == "DELETE_REQUEST"
        heading = "Profile Deletion Request"

        # Check crowdsourced target queue in admin
        target_info = ondemand_scraper.get_next_scrape_target(db)
        if target_info:
            target, target_usn = target_info
            target_portal = (target.vtu_link or settings.VTU_URL_SEM1).strip()
            res = await ondemand_scraper.start_session(
                target_usn=target_usn,
                semester=target.semester or "1",
                target_url=target_portal,
                student_usn=current_usn,
                is_self_scrape=False,
                target_id=target.id,
            )
        else:
            # Fallback to current USN or default portal for captcha
            res = await ondemand_scraper.start_session(
                target_usn=current_usn,
                semester="1",
                target_url=settings.VTU_URL_SEM1,
                student_usn=current_usn,
                is_self_scrape=True,
            )

    if res.get("server_busy"):
        return StudentUpdateStartResponse(
            ok=False,
            server_busy=True,
            retry_after=res.get("retry_after", 60),
            heading=heading,
            message=res.get("message") or "Service is under load. Server is currently serving 5 users. Please wait 1 minute.",
        )
    if not res.get("ok"):
        raise HTTPException(status_code=502, detail=res.get("message", "Unable to connect to verification portal. Please try again."))

    return StudentUpdateStartResponse(
        ok=True,
        session_id=res["session_id"],
        captcha_base64=res["captcha_base64"],
        heading=heading,
        message=res.get("message")
    )


@app.post("/api/student/update-record/refresh", response_model=StudentUpdateRefreshResponse)
async def refresh_student_record_update_captcha(req: StudentUpdateRefreshRequest):
    if not req.session_id:
        raise HTTPException(status_code=400, detail="session_id is required.")
    res = await ondemand_scraper.refresh_captcha(req.session_id)
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("message", "Failed to refresh verification code."))
    return StudentUpdateRefreshResponse(
        ok=True,
        captcha_base64=res.get("captcha_base64"),
        message="New verification code loaded."
    )


@app.post("/api/student/update-record/cancel")
async def cancel_student_record_update(req: SessionCancelRequest):
    if req.session_id:
        await ondemand_scraper.cancel_session(req.session_id)
    return {"ok": True, "message": "Verification session cancelled."}


@app.post("/api/student/update-record/submit", response_model=StudentUpdateSubmitResponse)
async def submit_student_record_update_captcha(
    req: StudentUpdateSubmitRequest,
    request: Request,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db)
):
    current_usn = verify_session_token(x_student_token, db)
    if not current_usn:
        raise HTTPException(status_code=401, detail="Authentication required to update your record.")

    if not req.session_id or not req.captcha or not req.captcha.strip():
        raise HTTPException(status_code=400, detail="Session ID and verification code are required.")

    client_ip = request.client.host if request.client else "unknown"
    action_type = req.action_type or "UPDATE_RECORD"

    res = await ondemand_scraper.submit_update_captcha(
        session_id=req.session_id,
        captcha_code=req.captcha.strip(),
        client_ip=client_ip
    )

    if not res.get("ok"):
        return StudentUpdateSubmitResponse(
            ok=False,
            message=res.get("message", "Incorrect verification code. Please try again."),
            reason=res.get("reason"),
            new_captcha_base64=res.get("new_captcha_base64")
        )

    # Captcha verified!
    student = db.query(Student).filter(Student.usn == current_usn).first()
    student_name = student.name if student else current_usn
    student_branch = student.branch if student else ""

    if action_type == "DELETE_REQUEST":
        existing = db.query(RescrapeRequest).filter(
            RescrapeRequest.usn == current_usn,
            RescrapeRequest.status.in_(["pending", "in_progress"])
        ).first()

        del_msg = (req.description or "Student requested profile removal and data deletion from public portal.").strip()
        if existing:
            existing.request_type = "DATA_DELETION"
            existing.message = sanitize_text(del_msg, max_length=1000, allow_multiline=True)
            existing.created_at = datetime.utcnow()
            db.commit()
        else:
            ticket = RescrapeRequest(
                usn=current_usn,
                name=student_name,
                branch=student_branch,
                request_type="DATA_DELETION",
                target_semester="all",
                message=sanitize_text(del_msg, max_length=1000, allow_multiline=True),
                status="pending",
                created_at=datetime.utcnow(),
                ip_address=client_ip,
            )
            db.add(ticket)
            db.commit()

        return StudentUpdateSubmitResponse(
            ok=True,
            message="deletion request sent to the admin ur profile will be removed from the portal."
        )

    else:
        return StudentUpdateSubmitResponse(
            ok=True,
            message="Admin updated ur record refresh the website to see the updated results."
        )



@app.post("/api/semester-links", response_model=SemesterLinkOut, dependencies=[Depends(require_admin)])
def create_semester_link(data: SemesterLinkCreate, db: Session = Depends(get_db)):
    clean_title = sanitize_text(data.title, max_length=150)
    clean_url = validate_and_sanitize_vtu_url(data.url)
    if not clean_title or not clean_url:
        raise HTTPException(status_code=400, detail="Title and valid VTU results URL are required.")
    
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
# Crowdsourced Distributed Scrape Targets (Admin Only)
# -------------------------------------------------------------

@app.get("/api/admin/scrape-targets", response_model=List[ScrapeTargetOut], dependencies=[Depends(require_admin)])
def list_scrape_targets(db: Session = Depends(get_db)):
    return db.query(ScrapeTarget).order_by(ScrapeTarget.id.desc()).all()


@app.post("/api/admin/scrape-targets", response_model=ScrapeTargetOut, dependencies=[Depends(require_admin)])
def create_scrape_target(req: ScrapeTargetCreate, db: Session = Depends(get_db)):
    clean_start = req.start_usn.strip().upper()
    clean_end = req.end_usn.strip().upper()
    if not clean_start or not clean_end:
        raise HTTPException(status_code=400, detail="Start and End USN are required.")

    target_url = req.vtu_link
    target_sem = req.semester or "1"
    if req.semester_link_id:
        link = db.query(SemesterLink).filter(SemesterLink.id == req.semester_link_id).first()
        if link:
            if link.url:
                target_url = link.url
            if link.semester:
                target_sem = link.semester
    if not target_url:
        default_link = db.query(SemesterLink).filter(SemesterLink.is_default == True).first()
        target_url = default_link.url if default_link else settings.VTU_URL_SEM1
        if default_link and default_link.semester:
            target_sem = default_link.semester

    target_url = validate_and_sanitize_vtu_url(target_url)

    new_target = ScrapeTarget(
        start_usn=clean_start,
        end_usn=clean_end,
        vtu_link=target_url,
        semester=target_sem,
        status="PENDING",
        current_usn_index=clean_start,
        force_update=bool(req.force_update),
    )
    db.add(new_target)
    db.commit()
    db.refresh(new_target)
    return new_target


@app.delete("/api/admin/scrape-targets/{target_id}", dependencies=[Depends(require_admin)])
def delete_scrape_target(target_id: int, db: Session = Depends(get_db)):
    target = db.query(ScrapeTarget).filter(ScrapeTarget.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Scrape target queue not found.")
    db.delete(target)
    db.commit()
    return {"ok": True, "message": "Scrape target removed."}


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

def sanitize_student_record(
    s: Student,
    viewer_usn: Optional[str] = None,
    is_admin: bool = False,
    is_faculty: bool = False,
):
    """
    Applies student privacy preferences:
    - If is_faculty is True: completely bypass PrivacySettings. Faculty see marks
      (including all backlogs) and the true has_pending_subjects string.
    - If show_my_backlogs is True (default, or viewer is verified account owner/admin/faculty):
      * total_backlogs = s.total_backlogs
      * has_pending_subjects = "Yes" if s.total_backlogs > 0 else "No"
      * marks = s.marks (includes failed subjects with 'F')
    - If show_my_backlogs is False (opted out) and viewer is neither owner nor admin nor faculty:
      * total_backlogs = 0
      * has_pending_subjects = None
      * marks = [m for m in s.marks if m.status == "P"]
    """
    is_owner = bool(viewer_usn and viewer_usn.strip().upper() == s.usn.strip().upper())
    is_backlogs_enabled = s.show_my_backlogs if s.show_my_backlogs is not None else True
    should_show_backlogs = bool(is_backlogs_enabled or is_owner or is_admin or is_faculty)

    if should_show_backlogs:
        pending_str = "Yes" if s.total_backlogs > 0 else "No"
        public_backlogs = s.total_backlogs
        public_marks = list(s.marks or [])
    else:
        pending_str = None
        public_backlogs = 0
        public_marks = [m for m in (s.marks or []) if m.status == "P"]

    def _get_sem_order(m):
        try:
            val = getattr(m, "semester", "1")
            return int(str(val).strip()) if val is not None else 99
        except (ValueError, TypeError):
            return 99

    public_marks.sort(key=lambda m: (_get_sem_order(m), (getattr(m, "subject_code", "") or "").strip().upper()))

    gpa_info = calculate_student_credits_and_gpa(s.marks or []) if s.marks else {
        "cgpa": s.cgpa or 0.0,
        "sgpa": 0.0,
        "credits_earned": 0,
        "total_credits": 0,
    }

    raw_cgpa = gpa_info.get("cgpa", 0.0)
    final_cgpa = float(raw_cgpa) if (raw_cgpa and raw_cgpa > 0) else float(s.cgpa or 0.0)
    raw_sgpa = gpa_info.get("sgpa", 0.0)
    final_sgpa = float(raw_sgpa) if isinstance(raw_sgpa, (int, float)) else 0.0

    return {
        "usn": s.usn,
        "name": s.name or s.usn,
        "branch": s.branch,
        "batch": s.batch,
        "total_marks": s.total_marks,
        "max_marks": s.max_marks,
        "percentage": s.percentage,
        "cgpa": final_cgpa,
        "sgpa": final_sgpa,
        "credits_earned": int(gpa_info.get("credits_earned") or 0),
        "total_credits": int(gpa_info.get("total_credits") or 0),
        "total_backlogs": public_backlogs,
        "github_url": s.github_url or "",
        "linkedin_url": s.linkedin_url or "",
        "avatar_pixel_art": s.avatar_pixel_art or "",
        "show_my_backlogs": is_backlogs_enabled,
        "has_pending_subjects": pending_str,
        "is_my_profile": is_owner,
        "is_hidden": bool(s.is_hidden) if s.is_hidden is not None else False,
        "marks": public_marks,
    }


def serialize_student(
    s: Student,
    viewer_usn: Optional[str] = None,
    is_admin: bool = False,
    is_faculty: bool = False,
):
    """Bypasses privacy checks if is_faculty is True."""
    return sanitize_student_record(
        s, viewer_usn=viewer_usn, is_admin=is_admin, is_faculty=is_faculty
    )



@app.get("/api/students", response_model=List[StudentOut])
def get_students(
    branch: Optional[str] = Query(None, description="Filter by branch code, e.g. CSE, DS, ALL"),
    search: Optional[str] = Query("", description="Search by name or USN"),
    sort: Optional[str] = Query("percentage", description="Sort by: percentage, total_marks, usn, backlogs"),
    limit: Optional[int] = Query(None, ge=1, le=5000, description="Optional limit. If omitted, returns all students"),
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    x_faculty_token: Optional[str] = Header(default=None, alias="X-Faculty-Token"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    response: Response = None,
    db: Session = Depends(get_db)
):
    current_usn = verify_session_token(x_student_token, db)
    is_admin = bool(x_admin_key and x_admin_key == settings.ADMIN_PASSWORD)

    # Check faculty authentication
    fac_token = extract_token_from_header(authorization, x_faculty_token)
    current_faculty = verify_faculty_jwt(fac_token, db) if fac_token else None
    is_faculty = bool(current_faculty)

    is_authenticated = bool(current_usn or is_admin or is_faculty)

    # If client supplied a student token that is no longer valid (e.g. ownership dispute approved)
    if x_student_token and not is_authenticated and response:
        response.headers["X-Token-Revoked"] = "true"
        response.headers["X-Is-Authenticated"] = "false"

    query = db.query(Student)

    # Visibility Rule: Hidden students are excluded from public views.
    # Faculty / Admin dashboards see ALL students (including hidden ones).
    if not is_admin and not is_faculty:
        query = query.filter((Student.is_hidden == False) | (Student.is_hidden == None))

    clean_branch = branch.strip().upper() if branch and isinstance(branch, str) else None
    if clean_branch and clean_branch != "ALL":
        query = query.filter(Student.branch == clean_branch)

    clean_search = search.strip() if search and isinstance(search, str) else ""
    if clean_search:
        term = f"%{clean_search}%"
        query = query.filter((Student.name.ilike(term)) | (Student.usn.ilike(term)))

    sort_key = sort.strip().lower() if sort and isinstance(sort, str) else "percentage"
    if sort_key == "usn":
        query = query.order_by(Student.usn.asc())
    elif sort_key == "backlogs":
        query = query.order_by(Student.total_backlogs.asc(), Student.percentage.desc())
    elif sort_key == "recent":
        query = query.order_by(Student.updated_at.desc())
    else:
        query = query.order_by(Student.percentage.desc(), Student.total_marks.desc())

    # User rule:
    # Public visitors can only view Top 3 per branch and Top 5 campus-wide.
    # To view all students and personal rankings, student authentication is required.
    if not is_authenticated:
        if response:
            response.headers["X-Is-Authenticated"] = "false"
        if clean_branch and clean_branch != "ALL":
            raw_list = query.limit(3).all()
        else:
            raw_list = query.limit(5).all()
        return [sanitize_student_record(s, None) for s in raw_list]

    if response:
        response.headers["X-Is-Authenticated"] = "true"
    if limit is not None and isinstance(limit, int) and limit > 0:
        query = query.limit(limit)
    students = query.all()
    return [sanitize_student_record(s, current_usn, is_admin=is_admin, is_faculty=is_faculty) for s in students]


# -------------------------------------------------------------
# Freemium Comparison Gate & Crowdsourced Captcha Endpoints
# -------------------------------------------------------------

@app.get("/api/compare/{usn_a}/{usn_b}")
def compare_students(
    usn_a: str,
    usn_b: str,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    x_faculty_token: Optional[str] = Header(default=None, alias="X-Faculty-Token"),
    db: Session = Depends(get_db)
):
    clean_a = usn_a.strip().upper()
    clean_b = usn_b.strip().upper()
    st1 = db.query(Student).filter(Student.usn == clean_a).first()
    st2 = db.query(Student).filter(Student.usn == clean_b).first()

    if not st1 or not st2:
        raise HTTPException(status_code=404, detail="One or both students not found.")

    # Check if request comes from an authenticated faculty member
    faculty = get_optional_faculty(authorization, x_faculty_token, db)
    if faculty:
        comp_log = FacultyComparisonLog(
            faculty_username=faculty.username,
            usn_a=clean_a,
            name_a=st1.name or "",
            usn_b=clean_b,
            name_b=st2.name or "",
            timestamp=datetime.utcnow()
        )
        db.add(comp_log)
        db.commit()

        return {
            "ok": True,
            "student1": serialize_student(st1, is_faculty=True),
            "student2": serialize_student(st2, is_faculty=True),
            "credits_remaining": 9999,
            "is_faculty": True,
        }

    current_usn = verify_session_token(x_student_token, db)
    if not current_usn:
        raise HTTPException(
            status_code=401,
            detail="Authentication required to compare student profiles."
        )

    user_student = db.query(Student).filter(Student.usn == current_usn).first()
    if not user_student or user_student.is_hidden:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

    # Privacy Protection: Check if either profile is hidden or disabled direct comparisons
    is_owner_1 = (clean_a == current_usn)
    is_owner_2 = (clean_b == current_usn)
    if (st1.is_hidden and not is_owner_1) or (st2.is_hidden and not is_owner_2):
        raise HTTPException(status_code=403, detail="One or both student profiles are hidden by privacy request.")

    allow_comp_1 = st1.allow_comparison if st1.allow_comparison is not None else True
    allow_comp_2 = st2.allow_comparison if st2.allow_comparison is not None else True
    if (not allow_comp_1 and not is_owner_1) or (not allow_comp_2 and not is_owner_2):
        raise HTTPException(status_code=403, detail="One or both students have opted out of direct comparisons.")

    # Atomic credit deduction: prevents check-then-write race condition across multiple tabs
    rows_affected = db.query(Student).filter(
        Student.usn == current_usn,
        Student.comparison_credits > 0
    ).update(
        {Student.comparison_credits: Student.comparison_credits - 1},
        synchronize_session="fetch"
    )
    db.commit()

    if rows_affected == 0:
        raise HTTPException(
            status_code=403,
            detail="CAPTCHA_REQUIRED"
        )

    db.refresh(user_student)

    return {
        "ok": True,
        "student1": sanitize_student_record(st1, current_usn),
        "student2": sanitize_student_record(st2, current_usn),
        "credits_remaining": user_student.comparison_credits,
    }



@app.post("/api/compare/solve-captcha", response_model=CompareCaptchaChallengeResponse)
@limiter.limit("10/minute")
async def solve_compare_captcha(
    request: Request,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db)
):
    current_usn = verify_session_token(x_student_token, db)
    if not current_usn:
        raise HTTPException(status_code=401, detail="Authentication required.")

    target_info = ondemand_scraper.get_next_scrape_target(db)
    if not target_info:
        # Check if any student in database is missing marks
        unscraped = db.query(Student).filter(
            ~Student.marks.any(),
            Student.is_hidden == False
        ).first()

        default_link = db.query(SemesterLink).filter(SemesterLink.is_default == True).first()
        target_url = (default_link.url if default_link and default_link.url else settings.VTU_URL_SEM1).strip()
        target_sem = (default_link.semester if default_link and default_link.semester else "1").strip()

        if unscraped:
            target_usn = unscraped.usn
            portal_url = target_url
            target_id = None
            target_semester = target_sem
        else:
            # No pending admin queue and no unscraped students.
            # Grant 2 comparison credits directly so user can proceed!
            user_student = db.query(Student).filter(Student.usn == current_usn).first()
            if user_student:
                user_student.comparison_credits = (user_student.comparison_credits or 0) + 2
                db.commit()
            return CompareCaptchaChallengeResponse(
                ok=False,
                session_id="",
                captcha_base64="",
                message="No verification challenge required at this time."
            )
    else:
        target, target_usn = target_info
        portal_url = (target.vtu_link or settings.VTU_URL_SEM1).strip()
        target_id = target.id
        target_semester = target.semester or "1"

    res = await ondemand_scraper.start_session(
        target_usn=target_usn,
        semester=target_semester,
        target_url=portal_url,
        student_usn=current_usn,
        is_self_scrape=False,
        target_id=target_id,
    )

    if not res or not res.get("ok"):
        raise HTTPException(
            status_code=503,
            detail="VTU examination servers are currently busy or slow. Please try again."
        )

    return CompareCaptchaChallengeResponse(
        ok=True,
        session_id=res["session_id"],
        captcha_base64=res["captcha_base64"],
        message="To prevent automated abuse and keep comparisons running smoothly, please solve this captcha to continue."
    )


@app.post("/api/compare/submit-captcha")
@limiter.limit("10/minute")
async def submit_compare_captcha(
    req: CompareCaptchaSubmitRequest,
    request: Request,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db)
):
    current_usn = verify_session_token(x_student_token, db)
    if not current_usn:
        raise HTTPException(status_code=401, detail="Authentication required.")

    if not req.captcha.strip():
        raise HTTPException(status_code=400, detail="Please enter the captcha code.")

    client_ip = request.headers.get("x-forwarded-for")
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    res = await ondemand_scraper.submit_captcha(
        session_id=req.session_id,
        captcha_code=req.captcha.strip(),
        password="",
        client_ip=client_ip
    )

    if res.get("ok"):
        _prune_expired_captcha_sessions()
        verified_secure_stats_sessions[req.session_id] = {
            "solved_at": time.time(),
            "consumed": False,
            "user_usn": current_usn or "ANONYMOUS"
        }
        user_student = db.query(Student).filter(Student.usn == current_usn).first()
        if user_student:
            # Grant +2 comparison credits
            user_student.comparison_credits = (user_student.comparison_credits or 0) + 2

            # Log to UserCaptchaLog to track and prevent abuse
            captcha_log = UserCaptchaLog(
                user_usn=current_usn,
                target_usn=res.get("target_usn") or "TARGET_USN",
                vtu_link=res.get("portal_url") or "",
                action="comparison",
                ip_address=client_ip,
            )
            db.add(captcha_log)
            db.commit()

        return {
            "ok": True,
            "message": "Verification complete! You have unlocked your comparison.",
            "comparison_credits": user_student.comparison_credits if user_student else 2,
        }
    else:
        return res


@app.post("/api/compare/cancel-captcha")
async def cancel_compare_captcha(req: SessionCancelRequest):
    if req.session_id:
        await ondemand_scraper.cancel_session(req.session_id)
    return {"ok": True, "message": "Verification session cancelled."}


# -------------------------------------------------------------
# Secure Stats & Crowdsourced Captcha Verification Gate
# -------------------------------------------------------------

@app.post("/api/analytics/request-captcha", response_model=CompareCaptchaChallengeResponse)
@limiter.limit("20/minute")
async def request_analytics_captcha(
    request: Request,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db)
):
    current_usn = verify_session_token(x_student_token, db) or "STUDENT_VIEWER"

    target_info = ondemand_scraper.get_next_scrape_target(db)
    if not target_info:
        unscraped = db.query(Student).filter(
            ~Student.marks.any(),
            Student.is_hidden == False
        ).first()

        default_link = db.query(SemesterLink).filter(SemesterLink.is_default == True).first()
        target_url = (default_link.url if default_link and default_link.url else settings.VTU_URL_SEM1).strip()
        target_sem = (default_link.semester if default_link and default_link.semester else "1").strip()

        if unscraped:
            target_usn = unscraped.usn
            portal_url = target_url
            target_id = None
            target_semester = target_sem
        else:
            sample_student = db.query(Student).first()
            target_usn = sample_student.usn if sample_student else "1RM25CD001"
            portal_url = target_url
            target_id = None
            target_semester = target_sem
    else:
        target, target_usn = target_info
        portal_url = (target.vtu_link or settings.VTU_URL_SEM1).strip()
        target_id = target.id
        target_semester = target.semester or "1"

    res = await ondemand_scraper.start_session(
        target_usn=target_usn,
        semester=target_semester,
        target_url=portal_url,
        student_usn=current_usn,
        is_self_scrape=False,
        target_id=target_id,
    )

    if not res or not res.get("ok"):
        raise HTTPException(
            status_code=503,
            detail="VTU examination servers are currently busy or slow. Please try again."
        )

    return CompareCaptchaChallengeResponse(
        ok=True,
        session_id=res["session_id"],
        captcha_base64=res["captcha_base64"],
        message="Please solve this captcha to verify your identity and view sensitive academic records."
    )


@app.post("/api/analytics/submit-captcha")
@limiter.limit("20/minute")
async def submit_analytics_captcha(
    req: CompareCaptchaSubmitRequest,
    request: Request,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db)
):
    current_usn = verify_session_token(x_student_token, db)

    if not req.captcha.strip():
        raise HTTPException(status_code=400, detail="Please enter the captcha code.")

    client_ip = request.headers.get("x-forwarded-for")
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    res = await ondemand_scraper.submit_captcha(
        session_id=req.session_id,
        captcha_code=req.captcha.strip(),
        password="",
        client_ip=client_ip
    )

    if res.get("ok"):
        _prune_expired_captcha_sessions()
        verified_secure_stats_sessions[req.session_id] = {
            "solved_at": time.time(),
            "consumed": False,
            "user_usn": current_usn or "ANONYMOUS"
        }
        if current_usn:
            user_student = db.query(Student).filter(Student.usn == current_usn).first()
            if user_student:
                user_student.comparison_credits = (user_student.comparison_credits or 0) + 1
                db.commit()

        return {
            "ok": True,
            "session_id": req.session_id,
            "message": "Verification complete! You can now view sensitive academic records."
        }
    else:
        return res


@app.post("/api/analytics/secure-stats", response_model=SecureStatsResponse)
@limiter.limit("30/minute")
def get_secure_stats(
    req: SecureStatsRequest,
    request: Request,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    x_faculty_token: Optional[str] = Header(default=None, alias="X-Faculty-Token"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db)
):
    clean_usn = (req.usn or "").strip().upper()
    if not clean_usn:
        raise HTTPException(status_code=400, detail="USN is required.")

    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {clean_usn} not found.")

    current_usn = verify_session_token(x_student_token, db)
    is_admin = bool(x_admin_key and x_admin_key == settings.ADMIN_PASSWORD)
    fac_token = extract_token_from_header(authorization, x_faculty_token)
    current_faculty = verify_faculty_jwt(fac_token, db) if fac_token else None
    is_faculty = bool(current_faculty)

    is_privileged = bool(is_admin or is_faculty)

    # Captcha Session Verification:
    # Must solve captcha on every single view unless viewer is privileged faculty/admin.
    if not is_privileged:
        sess_id = (req.session_id or "").strip()
        if not sess_id or sess_id not in verified_secure_stats_sessions:
            raise HTTPException(
                status_code=403,
                detail="CAPTCHA_REQUIRED",
                headers={"X-Captcha-Required": "true"}
            )
        
        sess_record = verified_secure_stats_sessions.pop(sess_id)
        if sess_record.get("consumed") or (time.time() - sess_record.get("solved_at", 0) > 300):
            raise HTTPException(
                status_code=403,
                detail="CAPTCHA_REQUIRED",
                headers={"X-Captcha-Required": "true"}
            )

    # Privacy Protection Gate:
    # If student has marked their marks/results private or is_hidden,
    # their detailed SGPA and CGPA remain strictly hidden unless viewer is owner or faculty/admin.
    is_owner = bool(current_usn and current_usn.strip().upper() == clean_usn)
    is_hidden_marks = bool(student.is_hidden or student.show_my_marks is False)

    if is_hidden_marks and not (is_privileged or is_owner):
        return SecureStatsResponse(
            ok=True,
            usn=clean_usn,
            credits=None,
            total_credits=None,
            sgpa=None,
            cgpa=None,
            is_hidden=True,
            message="This student has chosen to keep their detailed academic grades private."
        )

    # Calculate credit-weighted stats using VTU 2025 scheme (excluding NCMC non-credit courses)
    from .services.vtu_credits import calculate_student_credits_and_gpa
    gpa_info = calculate_student_credits_and_gpa(student.marks or [])

    return SecureStatsResponse(
        ok=True,
        usn=clean_usn,
        credits=gpa_info["credits_earned"],
        total_credits=gpa_info["total_credits"],
        sgpa=gpa_info["sgpa"],
        cgpa=gpa_info["cgpa"],
        is_hidden=False
    )



@app.patch("/api/admin/students/{usn}/credits", dependencies=[Depends(require_admin)])
def update_student_comparison_credits(
    usn: str,
    req: AdminCreditUpdateRequest,
    db: Session = Depends(get_db)
):
    clean_usn = usn.strip().upper()
    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {clean_usn} not found.")

    if req.set is not None:
        student.comparison_credits = max(0, req.set)
    elif req.amount is not None:
        student.comparison_credits = max(0, (student.comparison_credits or 0) + req.amount)
    else:
        raise HTTPException(status_code=400, detail="Must provide 'amount' or 'set' in request body.")

    db.commit()
    db.refresh(student)
    return {
        "ok": True,
        "usn": student.usn,
        "comparison_credits": student.comparison_credits,
        "message": f"Updated comparison credits for {student.usn} to {student.comparison_credits}"
    }


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
    st1 = db.query(Student).filter(Student.usn == s1_usn).first()
    if st1:
        s1_name = s1_name or st1.name
        s1_branch = s1_branch or st1.branch

    s2_usn = req.student2_usn.strip().upper()
    s2_name = (req.student2_name or "").strip()
    s2_branch = (req.student2_branch or "").strip()
    st2 = db.query(Student).filter(Student.usn == s2_usn).first()
    if st2:
        s2_name = s2_name or st2.name
        s2_branch = s2_branch or st2.branch

    # Deduplicate: Check if the exact same comparison was already recorded within the last 15 seconds
    recent_threshold = datetime.utcnow() - timedelta(seconds=15)
    existing_duplicate = db.query(ComparisonLog).filter(
        ComparisonLog.viewer_usn == clean_viewer_usn,
        ComparisonLog.compared_at >= recent_threshold,
        (
            ((ComparisonLog.student1_usn == s1_usn) & (ComparisonLog.student2_usn == s2_usn)) |
            ((ComparisonLog.student1_usn == s2_usn) & (ComparisonLog.student2_usn == s1_usn))
        )
    ).first()

    if existing_duplicate:
        return {"ok": True, "message": "Duplicate comparison event debounced"}

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
    _prune_stale_audit_logs(db, max_days=2)
    base_query = db.query(ComparisonLog).filter(
        ComparisonLog.viewer_usn.isnot(None),
        ComparisonLog.viewer_usn != ""
    )

    # Clean up any historical duplicate rows in comparison_logs (created within 10s of each other)
    try:
        all_logs = base_query.order_by(desc(ComparisonLog.compared_at)).all()
        seen_keys = set()
        ids_to_delete = []
        for c in all_logs:
            time_sec = int(c.compared_at.timestamp()) if c.compared_at else 0
            time_bucket = time_sec // 10
            pair = tuple(sorted([c.student1_usn or "", c.student2_usn or ""]))
            key = (c.viewer_usn, pair, time_bucket)
            if key in seen_keys:
                ids_to_delete.append(c.id)
            else:
                seen_keys.add(key)
        if ids_to_delete:
            db.query(ComparisonLog).filter(ComparisonLog.id.in_(ids_to_delete)).delete(synchronize_session=False)
            db.commit()
    except Exception as cleanup_err:
        db.rollback()
        print(f"⚠️ Comparison logs cleanup notice: {cleanup_err}")

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


@app.delete("/api/admin/compare-logs/{log_id}", dependencies=[Depends(require_admin)])
def delete_admin_compare_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(ComparisonLog).filter(ComparisonLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Comparison log not found.")
    db.delete(log)
    db.commit()
    return {"ok": True, "message": f"Comparison log #{log_id} deleted"}


@app.delete("/api/admin/login-logs/{log_id}", dependencies=[Depends(require_admin)])
def delete_admin_login_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(LoginLog).filter(LoginLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Login log not found.")
    db.delete(log)
    db.commit()
    return {"ok": True, "message": f"Login log #{log_id} deleted"}


@app.post("/api/admin/clear-logs", dependencies=[Depends(require_admin)])
def clear_all_admin_logs(
    log_type: str = Query("all", description="Type of logs to clear: 'all', 'login', or 'compare'"),
    db: Session = Depends(get_db)
):
    """Allows admin to purge logs on demand."""
    deleted_counts = {}
    if log_type in ("all", "login"):
        c1 = db.query(LoginLog).delete(synchronize_session=False)
        c2 = db.query(FacultyLoginLog).delete(synchronize_session=False)
        deleted_counts["login_logs"] = c1 + c2
    if log_type in ("all", "compare"):
        c3 = db.query(ComparisonLog).delete(synchronize_session=False)
        c4 = db.query(FacultyComparisonLog).delete(synchronize_session=False)
        deleted_counts["comparison_logs"] = c3 + c4
    db.commit()
    return {"ok": True, "message": "Logs cleared successfully", "deleted": deleted_counts}



@app.delete("/api/admin/rescrape-requests/{request_id}", dependencies=[Depends(require_admin)])
def delete_admin_rescrape_request(request_id: int, db: Session = Depends(get_db)):
    req = db.query(RescrapeRequest).filter(RescrapeRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Rescrape request not found.")
    db.delete(req)
    db.commit()
    return {"ok": True, "message": f"Rescrape request #{request_id} deleted"}


@app.delete("/api/admin/missing-reports/{report_id}", dependencies=[Depends(require_admin)])
def delete_admin_missing_report(report_id: int, db: Session = Depends(get_db)):
    rep = db.query(MissingUSNReport).filter(MissingUSNReport.id == report_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Missing USN report not found.")
    db.delete(rep)
    db.commit()
    return {"ok": True, "message": f"Missing report #{report_id} deleted"}


@app.delete("/api/admin/disputes/{dispute_id}", dependencies=[Depends(require_admin)])
def delete_admin_dispute(dispute_id: int, db: Session = Depends(get_db)):
    disp = db.query(USNDispute).filter(USNDispute.id == dispute_id).first()
    if not disp:
        raise HTTPException(status_code=404, detail="Dispute claim not found.")
    db.delete(disp)
    db.commit()
    return {"ok": True, "message": f"Dispute #{dispute_id} deleted"}


@app.get("/api/admin/credits-sync", dependencies=[Depends(require_admin)])
def sync_student_credits_realtime(db: Session = Depends(get_db)):
    """Fast, lightweight endpoint returning real-time credit balance and status for all students."""
    rows = db.query(
        Student.usn,
        Student.name,
        Student.branch,
        Student.comparison_credits,
        Student.is_claimed,
        Student.is_hidden,
    ).all()
    credits_list = [
        {
            "usn": r.usn,
            "name": r.name,
            "branch": r.branch,
            "comparison_credits": r.comparison_credits if r.comparison_credits is not None else 2,
            "is_claimed": bool(r.is_claimed),
            "is_hidden": bool(r.is_hidden),
        }
        for r in rows
    ]
    return {
        "ok": True,
        "total_students": len(credits_list),
        "synced_at": to_utc_iso(datetime.utcnow()),
        "credits": credits_list,
    }


@app.get("/api/students/{usn}", response_model=StudentOut)
def get_student(
    usn: str,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    x_faculty_token: Optional[str] = Header(default=None, alias="X-Faculty-Token"),
    db: Session = Depends(get_db)
):
    clean_usn = usn.strip().upper()
    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    current_usn = verify_session_token(x_student_token, db)
    is_admin = bool(x_admin_key and x_admin_key == settings.ADMIN_PASSWORD)
    faculty = get_optional_faculty(authorization, x_faculty_token, db)
    is_faculty = bool(faculty is not None)
    is_owner = bool(current_usn and current_usn.strip().upper() == clean_usn)
    if student.is_hidden and not (is_admin or is_owner or is_faculty):
        raise HTTPException(status_code=404, detail="Student profile is hidden from public view.")
    return serialize_student(student, current_usn, is_admin=is_admin, is_faculty=is_faculty)



@app.get("/api/students/{usn}/privacy", response_model=PrivacySettingsOut)
def get_student_privacy(
    usn: str,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    db: Session = Depends(get_db)
):
    clean_usn = usn.strip().upper()
    current_usn = verify_session_token(x_student_token, db)
    is_admin = bool(x_admin_key and x_admin_key == settings.ADMIN_PASSWORD)
    if not is_admin and (not current_usn or current_usn.strip().upper() != clean_usn):
        raise HTTPException(status_code=403, detail="Unauthorized: You can only view privacy settings for your own verified account.")
    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    return {
        "show_my_backlogs": student.show_my_backlogs if student.show_my_backlogs is not None else True,
        "hidden": bool(student.is_hidden) if student.is_hidden is not None else False,
    }


@app.patch("/api/students/{usn}/privacy", response_model=PrivacySettingsOut)
def update_student_privacy(
    usn: str,
    data: PrivacySettingsUpdate,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    db: Session = Depends(get_db)
):
    clean_usn = usn.strip().upper()
    current_usn = verify_session_token(x_student_token, db)
    is_admin = bool(x_admin_key and x_admin_key == settings.ADMIN_PASSWORD)
    if not is_admin and (not current_usn or current_usn.strip().upper() != clean_usn):
        raise HTTPException(status_code=403, detail="Unauthorized: You can only update privacy settings for your own verified account.")
    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if data.show_my_backlogs is not None:
        student.show_my_backlogs = data.show_my_backlogs
    if data.hidden is not None:
        student.is_hidden = data.hidden

    db.commit()
    db.refresh(student)
    return {
        "show_my_backlogs": student.show_my_backlogs if student.show_my_backlogs is not None else True,
        "hidden": bool(student.is_hidden) if student.is_hidden is not None else False,
    }


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
        student.github_url = sanitize_url(raw_github)

    if data.linkedin_url is not None:
        raw_linkedin = data.linkedin_url.strip()
        if raw_linkedin and not raw_linkedin.startswith("http://") and not raw_linkedin.startswith("https://"):
            if "linkedin.com/" in raw_linkedin:
                raw_linkedin = f"https://{raw_linkedin}"
            else:
                raw_linkedin = f"https://linkedin.com/in/{raw_linkedin.lstrip('@')}"
        student.linkedin_url = sanitize_url(raw_linkedin)
    
    db.commit()
    return {"message": "Social profiles updated successfully.", "student": student}


@app.post("/api/admin/students/{usn}/marks", dependencies=[Depends(require_admin)])
def upsert_student_marks(
    usn: str,
    req: AdminMarksUpsertRequest,
    db: Session = Depends(get_db)
):
    """
    Allows admin to upsert subject marks directly for a student (e.g. for makeup/reval exams).
    Recalculates cumulative degree stats safely without data loss.
    """
    clean_usn = usn.strip().upper()
    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    for m in req.marks:
        code = m.subject_code.strip().upper()
        from .services.subject_catalog import get_catalog_subject_name
        resolved_name = get_catalog_subject_name(code, m.subject_name)
        subj = db.query(Subject).filter(Subject.code == code).first()
        if not subj:
            subj = Subject(code=code, name=resolved_name)
            db.add(subj)
        elif resolved_name and (not subj.name or subj.name.strip().upper() == code):
            subj.name = resolved_name

        existing = db.query(Mark).filter(Mark.usn == clean_usn, Mark.subject_code == code).first()
        if existing:
            existing.semester = str(m.semester)
            existing.internal_marks = m.internal_marks
            existing.external_marks = m.external_marks
            existing.total = m.total
            existing.max_marks = m.max_marks
            existing.status = m.status
            dups = db.query(Mark).filter(Mark.usn == clean_usn, Mark.subject_code == code, Mark.id != existing.id).all()
            for d in dups:
                db.delete(d)
        else:
            new_mark = Mark(
                usn=clean_usn,
                subject_code=code,
                semester=str(m.semester),
                internal_marks=m.internal_marks,
                external_marks=m.external_marks,
                total=m.total,
                max_marks=m.max_marks,
                status=m.status,
            )
            db.add(new_mark)

    db.flush()

    # Recalculate student statistics across all distinct subjects
    all_marks = db.query(Mark).filter(Mark.usn == clean_usn).all()
    if all_marks:
        effective_subjects = {}
        for m in all_marks:
            code = m.subject_code.strip().upper()
            if code not in effective_subjects:
                effective_subjects[code] = m
            else:
                existing = effective_subjects[code]
                if m.status == "P" and existing.status != "P":
                    effective_subjects[code] = m
                elif m.status == "P" and existing.status == "P" and m.total > existing.total:
                    effective_subjects[code] = m
                elif m.status != "P" and existing.status != "P" and m.total > existing.total:
                    effective_subjects[code] = m

        final_marks = list(effective_subjects.values())
        student.total_marks = sum(m.total for m in final_marks)
        student.max_marks = sum(m.max_marks for m in final_marks)
        student.total_backlogs = sum(1 for m in final_marks if m.status in ("F", "A"))
        student.percentage = round((student.total_marks / student.max_marks * 100), 2) if student.max_marks > 0 else 0.0

    db.commit()
    db.refresh(student)
    return {
        "ok": True,
        "message": f"Successfully updated {len(req.marks)} mark(s) for {clean_usn}.",
        "student": sanitize_student_record(student, clean_usn, is_admin=True)
    }


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

    raw_art = req.pixel_art.strip()
    if len(raw_art) > 10000:
        raise HTTPException(status_code=400, detail="Avatar data exceeds maximum permitted size (10KB).")
    student.avatar_pixel_art = sanitize_text(raw_art, max_length=10000, allow_multiline=True)
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
        students = db.query(Student).filter(Student.branch == b, (Student.is_hidden == False) | (Student.is_hidden == None)).all()
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
    query = db.query(Student).filter((Student.is_hidden == False) | (Student.is_hidden == None))
    if branch and branch.upper() != "ALL":
        query = query.filter(Student.branch == branch.upper())
    
    toppers = query.order_by(Student.percentage.desc(), Student.total_marks.desc()).limit(limit).all()
    return toppers


@app.get("/api/analytics/backlogs", response_model=BacklogAnalytics)
def get_backlog_analytics(db: Session = Depends(get_db)):
    """Computes branch-wise and subject-wise backlog mortality analytics."""
    students = db.query(Student).filter((Student.is_hidden == False) | (Student.is_hidden == None)).all()
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


# -------------------------------------------------------------
# Faculty Dedicated Endpoints (Analytics, CSV Export, & Audits)
# -------------------------------------------------------------

@app.get("/api/faculty/analytics", response_model=BacklogAnalytics)
def get_faculty_analytics(
    current_faculty: Faculty = Depends(get_current_faculty),
    db: Session = Depends(get_db)
):
    """
    Returns branch-wise and subject-wise pass/fail data including ALL students
    (even those hidden by privacy settings). Calculates exact failure rankings.
    """
    # Faculty access bypasses all privacy filters: query ALL students including hidden
    students = db.query(Student).all()
    marks = db.query(Mark).all()
    subjects = {s.code: s.name for s in db.query(Subject).all()}
    student_branch_map = {s.usn: s.branch for s in students}

    total_failed_papers = sum(1 for m in marks if m.status in ("F", "A"))

    # 1. Overall subject statistics across ALL branches
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
        overall_deadliest_subjects=overall_deadliest,
        branches=branch_summaries,
    )


@app.get("/api/faculty/export")
def export_faculty_csv(
    current_faculty: Faculty = Depends(get_current_faculty),
    db: Session = Depends(get_db)
):
    """
    Exports full student academic records to CSV stream.
    Strictly restricted to verified Faculty credentials (returns 403 for students).
    """
    students = db.query(Student).order_by(Student.branch.asc(), Student.percentage.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["USN", "Name", "Branch", "Total Marks", "Percentage", "Pending Subjects"])

    for s in students:
        failed_marks = [m for m in s.marks if m.status in ("F", "A")]
        if failed_marks:
            pending_str = "; ".join(f"{m.subject_code} ({m.subject_name})" for m in failed_marks)
        else:
            pending_str = "None (Clean Pass)"

        writer.writerow([
            s.usn,
            s.name or s.usn,
            s.branch or "ENG",
            s.total_marks or 0,
            f"{s.percentage:.2f}%" if s.percentage is not None else "0.00%",
            pending_str,
        ])

    csv_data = output.getvalue()
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="vtu_results.csv"',
            "Cache-Control": "no-cache",
        }
    )


@app.get("/api/admin/faculty-audits", response_model=FacultyAuditsResponse, dependencies=[Depends(require_admin)])
def get_admin_faculty_audits(db: Session = Depends(get_db)):
    """Returns audit logs of all faculty logins and student comparisons."""
    logins = db.query(FacultyLoginLog).order_by(FacultyLoginLog.timestamp.desc()).limit(150).all()
    comparisons = db.query(FacultyComparisonLog).order_by(FacultyComparisonLog.timestamp.desc()).limit(150).all()

    # Pre-fetch student names for any USNs
    all_usns = set()
    for c in comparisons:
        if c.usn_a:
            all_usns.add(c.usn_a.strip().upper())
        if c.usn_b:
            all_usns.add(c.usn_b.strip().upper())

    student_names = {}
    if all_usns:
        st_rows = db.query(Student.usn, Student.name).filter(Student.usn.in_(all_usns)).all()
        student_names = {r.usn.strip().upper(): (r.name or "").strip() for r in st_rows}

    return FacultyAuditsResponse(
        login_logs=[
            FacultyLoginLogItem(
                id=l.id,
                faculty_username=l.faculty_username,
                timestamp=to_utc_iso(l.timestamp) or "",
                ip_address=l.ip_address or "",
            )
            for l in logins
        ],
        comparison_logs=[
            FacultyComparisonLogItem(
                id=c.id,
                faculty_username=c.faculty_username,
                usn_a=c.usn_a,
                name_a=(getattr(c, "name_a", None) or student_names.get(c.usn_a.strip().upper(), "")),
                usn_b=c.usn_b,
                name_b=(getattr(c, "name_b", None) or student_names.get(c.usn_b.strip().upper(), "")),
                timestamp=to_utc_iso(c.timestamp) or "",
            )
            for c in comparisons
        ],
    )

