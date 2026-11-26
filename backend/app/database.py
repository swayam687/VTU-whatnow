from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

db_url = settings.DATABASE_URL

# Normalize postgres:// to postgresql:// for SQLAlchemy compatibility
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Ensure the right driver is targeted if generic postgresql:// is provided
if db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    try:
        import psycopg  # noqa: F401
    except ImportError:
        pass

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
    connect_args = {
        "connect_timeout": 8,  # Prevent infinite TCP hang on cloud port scans
    }
    # In psycopg (psycopg 3), prepared statements must be disabled when using PgBouncer / Supabase transaction poolers
    # to prevent psycopg.errors.DuplicatePreparedStatement: prepared statement "_pg3_0" already exists
    if "psycopg" in db_url or (db_url.startswith("postgresql://") and "psycopg2" not in db_url):
        try:
            import psycopg  # noqa: F401
            connect_args["prepare_threshold"] = None
        except ImportError:
            pass
    engine_kwargs["connect_args"] = connect_args

engine = create_engine(db_url, **engine_kwargs)

if db_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

    try:
        with engine.connect() as _con:
            _con.exec_driver_sql("PRAGMA journal_mode=WAL")
    except Exception:
        pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
