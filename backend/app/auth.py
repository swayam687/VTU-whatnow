import hashlib
import secrets
from typing import Optional
from fastapi import Header, Depends
from sqlalchemy.orm import Session
from .config import settings
from .models import Student
from .database import get_db

# In-memory session store (token -> usn)
AUTH_SESSIONS: dict[str, str] = {}

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
    if not token or ":" not in token:
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
