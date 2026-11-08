"""
Migrate local SQLite database (vtuwhatnow.db) to Supabase / PostgreSQL.

Usage:
    python migrate_to_supabase.py "<YOUR_SUPABASE_DATABASE_URL>"

Example:
    python migrate_to_supabase.py "postgresql://postgres.xxxx:yourpassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
"""

import sys
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup local import path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.models import Base, Student, Subject, Mark

def migrate(target_url: str):
    if not target_url or not target_url.startswith(("postgres://", "postgresql://")):
        print("❌ Error: Please provide a valid PostgreSQL / Supabase connection URL.")
        print("Usage: python migrate_to_supabase.py \"postgresql://postgres:...@...supabase.co:5432/postgres\"")
        return

    # Normalize url
    if target_url.startswith("postgres://"):
        target_url = target_url.replace("postgres://", "postgresql://", 1)

    if target_url.startswith("postgresql://") and not target_url.startswith("postgresql+"):
        try:
            import psycopg  # noqa: F401
        except ImportError:
            try:
                import psycopg2  # noqa: F401
                target_url = target_url.replace("postgresql://", "postgresql+psycopg2://", 1)
            except ImportError:
                pass

    sqlite_path = backend_dir / "vtuwhatnow.db"
    if not sqlite_path.exists():
        print(f"❌ Error: Local database file not found at {sqlite_path}")
        return

    print(f"📦 Source SQLite DB: {sqlite_path}")
    print(f"🌐 Target Supabase URL: {target_url.split('@')[-1]}")

    # 1. Connect to SQLite
    sqlite_engine = create_engine(f"sqlite:///{sqlite_path}")
    SqliteSession = sessionmaker(bind=sqlite_engine)
    sqlite_db = SqliteSession()

    # 2. Connect to Supabase
    target_engine = create_engine(target_url, pool_pre_ping=True)
    TargetSession = sessionmaker(bind=target_engine)
    target_db = TargetSession()

    # 3. Create tables in Supabase
    print("⏳ Creating database tables on Supabase...")
    Base.metadata.create_all(bind=target_engine)

    # 4. Read local records
    local_students = sqlite_db.query(Student).all()
    local_subjects = sqlite_db.query(Subject).all()
    local_marks = sqlite_db.query(Mark).all()

    print(f"📋 Found locally: {len(local_students)} students, {len(local_subjects)} subjects, {len(local_marks)} marks.")

    # 5. Migrate Subjects
    print("⏳ Syncing subjects...")
    for s in local_subjects:
        existing = target_db.query(Subject).filter(Subject.code == s.code).first()
        if not existing:
            target_db.add(Subject(code=s.code, name=s.name))
    target_db.commit()

    # 6. Migrate Students
    print("⏳ Syncing students...")
    for st in local_students:
        existing = target_db.query(Student).filter(Student.usn == st.usn).first()
        if not existing:
            target_db.add(Student(
                usn=st.usn,
                name=st.name,
                branch=st.branch,
                batch=st.batch,
                total_marks=st.total_marks,
                max_marks=st.max_marks,
                percentage=st.percentage,
                cgpa=st.cgpa,
                total_backlogs=st.total_backlogs,
                github_url=st.github_url,
                linkedin_url=st.linkedin_url,
            ))
    target_db.commit()

    # 7. Migrate Marks
    print("⏳ Syncing marks...")
    for m in local_marks:
        existing = target_db.query(Mark).filter(
            Mark.usn == m.usn,
            Mark.subject_code == m.subject_code
        ).first()
        if not existing:
            target_db.add(Mark(
                usn=m.usn,
                subject_code=m.subject_code,
                semester=m.semester,
                internal_marks=m.internal_marks,
                external_marks=m.external_marks,
                total=m.total,
                max_marks=m.max_marks,
                status=m.status,
            ))
    target_db.commit()

    # 8. Verify
    remote_count = target_db.query(Student).count()
    print(f"🎉 Migration Complete! Supabase now contains {remote_count} students.")

    sqlite_db.close()
    target_db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python migrate_to_supabase.py \"<SUPABASE_DATABASE_URL>\"")
        sys.exit(1)
    migrate(sys.argv[1])

