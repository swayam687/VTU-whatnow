from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

db_url = settings.DATABASE_URL

# Normalize postgres:// to postgresql:// for SQLAlchemy compatibility
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Pin SQLite database file path to backend directory so it never splits across CWDs
if db_url.startswith("sqlite:///") and not db_url.startswith("sqlite:////") and ":/" not in db_url[10:]:
    backend_dir = Path(__file__).resolve().parent.parent
    db_filename = db_url.replace("sqlite:///", "").lstrip("./").lstrip(".\\")
    abs_db_path = (backend_dir / db_filename).resolve()
    db_url = f"sqlite:///{abs_db_path}"

engine_kwargs = {}
if db_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Cloud Postgres connection resilience (Supabase / Neon / Render)
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(db_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
