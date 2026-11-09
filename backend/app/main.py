import sys
from pathlib import Path

# Add backend directory to sys.path so 'app' can be imported anywhere
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .database import engine, get_db
from . import models
from .models import Student, Subject, Mark, SemesterLink
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
)
from .services.job_manager import job_manager
from .scraper.worker import scraper_worker

# Create DB tables on startup safely (tables are already seeded in Supabase)
try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"⚠️ Warning: metadata.create_all did not run on import ({e}). Will proceed.")

app = FastAPI(title="VTU WhatNow API", version="1.0.0")

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
    db: Session = Depends(get_db)
):
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

    students = query.limit(limit).all()
    return students


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
