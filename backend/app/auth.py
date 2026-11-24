import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
import jwt
from fastapi import Header, Depends, HTTPException
from sqlalchemy.orm import Session
from .config import settings
from .models import Student, Faculty
from .database import get_db

# In-memory session store (token -> usn)
AUTH_SESSIONS: dict[str, str] = {}

FACULTY_JWT_SECRET = getattr(settings, "SECRET_KEY", None) or f"vtu_whatnow_faculty_secure_jwt_secret_token_2026_{settings.ADMIN_PASSWORD}"
FACULTY_JWT_ALGORITHM = "HS256"

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
    if not token or not isinstance(token, str) or ":" not in token:
        return None
    parts = token.split(":")
    if len(parts) < 3:
        return None
    usn = parts[0].strip().upper()
    token_sig = parts[1]

    # Verify student exists and has claimed password and is not hidden/deleted
    student = db.query(Student).filter(Student.usn == usn).first()
    if not student or not student.password_hash or not student.is_claimed or student.is_hidden:
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


def create_faculty_jwt(faculty: Faculty, expires_in_days: int = 7) -> str:
    """Creates a signed JWT token for an authenticated faculty member."""
    now = datetime.utcnow()
    payload = {
        "sub": faculty.username,
        "username": faculty.username,
        "name": faculty.name,
        "department": faculty.department,
        "role": "faculty",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=expires_in_days)).timestamp()),
    }
    return jwt.encode(payload, FACULTY_JWT_SECRET, algorithm=FACULTY_JWT_ALGORITHM)


def extract_token_from_header(authorization: Optional[str], x_token: Optional[str]) -> Optional[str]:
    if authorization and isinstance(authorization, str) and authorization.strip():
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
        return authorization.strip()
    if x_token and isinstance(x_token, str) and x_token.strip():
        return x_token.strip()
    return None


def verify_faculty_jwt(token: Optional[str], db: Session) -> Optional[Faculty]:
    """Decodes and validates a faculty JWT token, returning the Faculty entity."""
    if not token or not isinstance(token, str):
        return None
    try:
        payload = jwt.decode(token, FACULTY_JWT_SECRET, algorithms=[FACULTY_JWT_ALGORITHM])
        if payload.get("role") != "faculty":
            return None
        username = payload.get("username") or payload.get("sub")
        if not username:
            return None
        faculty = db.query(Faculty).filter(Faculty.username == username).first()
        return faculty
    except (jwt.PyJWTError, Exception):
        return None


def get_current_faculty(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    x_faculty_token: Optional[str] = Header(default=None, alias="X-Faculty-Token"),
    db: Session = Depends(get_db),
) -> Faculty:
    token = extract_token_from_header(authorization, x_faculty_token)
    faculty = verify_faculty_jwt(token, db)
    if not faculty:
        raise HTTPException(
            status_code=403,
            detail="Faculty access forbidden. Valid faculty credentials required.",
        )
    return faculty


def get_optional_faculty(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    x_faculty_token: Optional[str] = Header(default=None, alias="X-Faculty-Token"),
    db: Session = Depends(get_db),
) -> Optional[Faculty]:
    token = extract_token_from_header(authorization, x_faculty_token)
    return verify_faculty_jwt(token, db)

