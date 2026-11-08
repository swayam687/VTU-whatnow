from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

db_url = settings.DATABASE_URL

# Pin SQLite database file path to backend directory so it never splits across CWDs
if db_url.startswith("sqlite:///") and not db_url.startswith("sqlite:////") and ":/" not in db_url[10:]:
    backend_dir = Path(__file__).resolve().parent.parent
    db_filename = db_url.replace("sqlite:///", "").lstrip("./").lstrip(".\\")
    abs_db_path = (backend_dir / db_filename).resolve()
    db_url = f"sqlite:///{abs_db_path}"

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(db_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
