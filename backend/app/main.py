import sys
import os
from pathlib import Path

if sys.platform == "win32":
    import asyncio
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

# Add backend directory to sys.path so 'app' can be imported anywhere
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from typing import List, Optional
from datetime import datetime, timezone, timedelta
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
from sqlalchemy import text, desc, func, distinct, inspect

from .config import settings
from .database import engine, get_db
from . import models
from .models import Student, Subject, Mark, SemesterLink, LoginLog, USNDispute, ComparisonLog, MissingUSNReport, RescrapeRequest, ScrapeTarget, UserCaptchaLog
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
)
from .services.job_manager import job_manager
from .scraper.worker import scraper_worker
from .services.ondemand_scraper import ondemand_scraper
from .auth import (
    hash_password,
    verify_password,
    compute_pw_sig,
    create_session,
    verify_session_token,
    get_current_student_usn,
    AUTH_SESSIONS,
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

        print("✅ Database schema initialized and verified.")
    except Exception as e:
        print(f"⚠️ Notice: DB connection check ({e}). Web service remains live.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Execute database schema check synchronously before accepting traffic
    init_db()
    yield

app = FastAPI(title="VTU WhatNow API", version="1.0.0", lifespan=lifespan)

# CORS setup - dynamically allows localhost, 127.0.0.1, LAN IPs, and production origins with credentials
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if (origins and "*" not in origins) else [],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
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
        is_hidden=bool(student.is_hidden),
    )


@app.post("/api/auth/login-or-register", response_model=LoginGateChallengeResponse)
async def login_or_register(req: AuthLoginRequest, request: Request, db: Session = Depends(get_db)):
    clean_usn = req.usn.strip().upper()
    password = req.password.strip()

    if not clean_usn or not password:
        raise HTTPException(status_code=400, detail="USN and password are required.")

    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    client_ip = request.client.host if request.client else "unknown"
    student = db.query(Student).filter(Student.usn == clean_usn).first()

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

        if not res or not res.get("ok"):
            raise HTTPException(
                status_code=503,
                detail=res.get("message", "Unable to reach VTU portal for self-registration.") if res else "VTU servers unresponsive."
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

    # Fallback auto-target: if no ScrapeTarget in database, look for any unscraped student or generate next batch
    if not target_info:
        unscraped_student = db.query(Student).outerjoin(Mark).filter(Mark.id == None).first()
        default_link = db.query(SemesterLink).filter(SemesterLink.is_default == True).first()
        target_url = default_link.url if default_link else settings.VTU_URL_SEM1
        if unscraped_student:
            auto_target = ScrapeTarget(
                start_usn=unscraped_student.usn,
                end_usn=unscraped_student.usn,
                vtu_link=target_url,
                semester="1",
                status="PENDING",
                current_usn_index=unscraped_student.usn,
            )
            db.add(auto_target)
            db.commit()
            db.refresh(auto_target)
            target_info = (auto_target, unscraped_student.usn)
        else:
            college_prefix = clean_usn[:5]
            existing_targets_count = db.query(ScrapeTarget).count()
            base_index = (existing_targets_count + 1) * 10 + 1
            next_usn = f"{college_prefix}CS{base_index:03d}"
            end_usn = f"{college_prefix}CS{base_index + 10:03d}"
            auto_target = ScrapeTarget(
                start_usn=next_usn,
                end_usn=end_usn,
                vtu_link=target_url,
                semester="1",
                status="PENDING",
                current_usn_index=next_usn,
            )
            db.add(auto_target)
            db.commit()
            db.refresh(auto_target)
            target_info = (auto_target, next_usn)

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
        err_msg = res.get("message", "Timeout") if res else "VTU examination servers unresponsive"
        raise HTTPException(
            status_code=503,
            detail=f"VTU examination servers are currently slow or unreachable ({err_msg}). Please try again in 5 seconds."
        )


@app.post("/api/auth/gate/submit", response_model=LoginGateSubmitResponse)
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
                existing_active.message = req.message.strip() if req.message else "Data deletion requested."
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
    student_name = req.name.strip() if req.name else (student.name if student else clean_usn)
    student_branch = req.branch.strip().upper() if req.branch else (student.branch if student else "")

    vtu_link_val = (req.vtu_link or req.custom_url or "").strip()
    entry = RescrapeRequest(
        usn=clean_usn,
        name=student_name,
        branch=student_branch,
        request_type=req.request_type,
        target_semester=req.target_semester or "1",
        subject_codes=req.subject_codes.strip() if req.subject_codes else "",
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

    elif req.action == "hide_student":
        student = db.query(Student).filter(Student.usn == item.usn).first()
        if student:
            student.is_hidden = True
            # Invalidate all active sessions for this USN to immediately throw them out
            tokens_to_evict = [t for t, u in list(AUTH_SESSIONS.items()) if u.strip().upper() == item.usn.strip().upper()]
            for t in tokens_to_evict:
                AUTH_SESSIONS.pop(t, None)
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
    if hidden:
        # Throw them out: Invalidate any active sessions immediately
        tokens_to_evict = [t for t, u in list(AUTH_SESSIONS.items()) if u.strip().upper() == clean_usn]
        for t in tokens_to_evict:
            AUTH_SESSIONS.pop(t, None)
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
    if not target_url and req.semester_link_id:
        link = db.query(SemesterLink).filter(SemesterLink.id == req.semester_link_id).first()
        if link and link.url:
            target_url = link.url
    if not target_url:
        default_link = db.query(SemesterLink).filter(SemesterLink.is_default == True).first()
        target_url = default_link.url if default_link else settings.VTU_URL_SEM1

    new_target = ScrapeTarget(
        start_usn=clean_start,
        end_usn=clean_end,
        vtu_link=target_url,
        semester=req.semester or "1",
        status="PENDING",
        current_usn_index=clean_start,
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

def sanitize_student_record(s: Student, viewer_usn: Optional[str] = None, is_admin: bool = False):
    """
    Applies student privacy preferences:
    - Name, USN, Marks, Percentile, and Comparison are ALWAYS public for all students.
    - The ONLY thing a student can control is show_my_backlogs (default: True).
    - If show_my_backlogs is True (default, or viewer is verified account owner/admin):
      * total_backlogs = s.total_backlogs
      * has_pending_subjects = "Yes" if s.total_backlogs > 0 else "No"
      * marks = s.marks (includes failed subjects with 'F')
    - If show_my_backlogs is False (opted out):
      * total_backlogs = 0
      * has_pending_subjects = None
      * marks = [m for m in s.marks if m.status == "P"]
    """
    is_owner = bool(viewer_usn and viewer_usn.strip().upper() == s.usn.strip().upper())
    is_backlogs_enabled = s.show_my_backlogs if s.show_my_backlogs is not None else True
    should_show_backlogs = bool(is_backlogs_enabled or is_owner or is_admin)

    if should_show_backlogs:
        pending_str = "Yes" if s.total_backlogs > 0 else "No"
        public_backlogs = s.total_backlogs
        public_marks = s.marks
    else:
        pending_str = None
        public_backlogs = 0
        public_marks = [m for m in s.marks if m.status == "P"]

    return {
        "usn": s.usn,
        "name": s.name or s.usn,
        "branch": s.branch,
        "batch": s.batch,
        "total_marks": s.total_marks,
        "max_marks": s.max_marks,
        "percentage": s.percentage,
        "cgpa": s.cgpa,
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


@app.get("/api/students", response_model=List[StudentOut])
def get_students(
    branch: Optional[str] = Query(None, description="Filter by branch code, e.g. CSE, DS, ALL"),
    search: Optional[str] = Query("", description="Search by name or USN"),
    sort: Optional[str] = Query("percentage", description="Sort by: percentage, total_marks, usn, backlogs"),
    limit: Optional[int] = Query(100, ge=1, le=500),
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    response: Response = None,
    db: Session = Depends(get_db)
):
    current_usn = verify_session_token(x_student_token, db)
    is_admin = bool(x_admin_key and x_admin_key == settings.ADMIN_PASSWORD)
    is_authenticated = bool(current_usn or is_admin)

    # If client supplied a student token that is no longer valid (e.g. ownership dispute approved)
    if x_student_token and not is_authenticated and response:
        response.headers["X-Token-Revoked"] = "true"
        response.headers["X-Is-Authenticated"] = "false"

    query = db.query(Student)

    # Visibility Rule: Hidden students are excluded from public views.
    # Faculty / Admin dashboards see ALL students (including hidden ones).
    if not is_admin:
        query = query.filter((Student.is_hidden == False) | (Student.is_hidden == None))

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
            raw_list = query.limit(3).all()
        else:
            raw_list = query.limit(5).all()
        return [sanitize_student_record(s, None) for s in raw_list]

    if response:
        response.headers["X-Is-Authenticated"] = "true"
    students = query.limit(limit).all()
    return [sanitize_student_record(s, current_usn) for s in students]


# -------------------------------------------------------------
# Freemium Comparison Gate & Crowdsourced Captcha Endpoints
# -------------------------------------------------------------

@app.get("/api/compare/{usn_a}/{usn_b}")
def compare_students(
    usn_a: str,
    usn_b: str,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db)
):
    current_usn = verify_session_token(x_student_token, db)
    if not current_usn:
        raise HTTPException(
            status_code=401,
            detail="Authentication required to compare student profiles."
        )

    user_student = db.query(Student).filter(Student.usn == current_usn).first()
    if not user_student or user_student.is_hidden:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

    # Step 1: Check comparison credits
    if (user_student.comparison_credits or 0) <= 0:
        # Step 3: Out of credits -> Return 403 CAPTCHA_REQUIRED
        raise HTTPException(
            status_code=403,
            detail="CAPTCHA_REQUIRED"
        )

    # Step 2: Deduct 1 credit
    user_student.comparison_credits = max(0, user_student.comparison_credits - 1)
    db.commit()

    clean_a = usn_a.strip().upper()
    clean_b = usn_b.strip().upper()
    st1 = db.query(Student).filter(Student.usn == clean_a).first()
    st2 = db.query(Student).filter(Student.usn == clean_b).first()

    if not st1 or not st2:
        raise HTTPException(status_code=404, detail="One or both students not found.")

    return {
        "ok": True,
        "student1": sanitize_student_record(st1, current_usn),
        "student2": sanitize_student_record(st2, current_usn),
        "credits_remaining": user_student.comparison_credits,
    }


@app.post("/api/compare/solve-captcha", response_model=CompareCaptchaChallengeResponse)
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
        unscraped = db.query(Student).filter(
            ~Student.marks.any(),
            Student.is_hidden == False
        ).first()

        target_url = settings.VTU_URL_SEM1
        if unscraped:
            auto_target = ScrapeTarget(
                start_usn=unscraped.usn,
                end_usn=unscraped.usn,
                vtu_link=target_url,
                semester="1",
                status="PENDING",
                current_usn_index=unscraped.usn,
            )
            db.add(auto_target)
            db.commit()
            db.refresh(auto_target)
            target_info = (auto_target, unscraped.usn)
        else:
            college_prefix = current_usn[:5] if len(current_usn) >= 5 else "1RM25"
            existing_count = db.query(ScrapeTarget).count()
            base_idx = (existing_count + 1) * 10 + 1
            next_usn = f"{college_prefix}CS{base_idx:03d}"
            auto_target = ScrapeTarget(
                start_usn=next_usn,
                end_usn=f"{college_prefix}CS{base_idx + 10:03d}",
                vtu_link=target_url,
                semester="1",
                status="PENDING",
                current_usn_index=next_usn,
            )
            db.add(auto_target)
            db.commit()
            db.refresh(auto_target)
            target_info = (auto_target, next_usn)

    target, target_usn = target_info
    portal_url = (target.vtu_link or settings.VTU_URL_SEM1).strip()
    res = await ondemand_scraper.start_session(
        target_usn=target_usn,
        semester=target.semester or "1",
        target_url=portal_url,
        student_usn=current_usn,
        is_self_scrape=False,
        target_id=target.id,
    )

    if not res or not res.get("ok"):
        err_msg = res.get("message", "Timeout") if res else "VTU examination servers unresponsive"
        raise HTTPException(
            status_code=503,
            detail=f"VTU examination servers are currently slow or unreachable ({err_msg}). Please try again in 5 seconds."
        )

    return CompareCaptchaChallengeResponse(
        ok=True,
        session_id=res["session_id"],
        captcha_base64=res["captcha_base64"],
        message="To prevent automated abuse and keep comparisons running smoothly, please solve this captcha to continue."
    )


@app.post("/api/compare/submit-captcha")
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
def get_student(
    usn: str,
    x_student_token: Optional[str] = Header(default=None, alias="X-Student-Token"),
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    db: Session = Depends(get_db)
):
    clean_usn = usn.strip().upper()
    student = db.query(Student).filter(Student.usn == clean_usn).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    current_usn = verify_session_token(x_student_token, db)
    is_admin = bool(x_admin_key and x_admin_key == settings.ADMIN_PASSWORD)
    is_owner = bool(current_usn and current_usn.strip().upper() == clean_usn)
    if student.is_hidden and not (is_admin or is_owner):
        raise HTTPException(status_code=404, detail="Student profile is hidden from public view.")
    return sanitize_student_record(student, current_usn, is_admin=is_admin)


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
        subj = db.query(Subject).filter(Subject.code == code).first()
        if not subj:
            subj = Subject(code=code, name=m.subject_name or code)
            db.add(subj)
        elif m.subject_name and not subj.name:
            subj.name = m.subject_name

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
