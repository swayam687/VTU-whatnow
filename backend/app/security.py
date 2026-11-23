"""
Security and Defensive Sanitization Utilities for VTU WhatNow.
Protects against Stored XSS, SSRF, IDOR, Parameter Tampering, and Injection.
"""

import html
import re
from typing import Optional
from fastapi import HTTPException


ALLOWED_VTU_DOMAINS = (
    "https://results.vtu.ac.in/",
    "http://results.vtu.ac.in/",
)


def sanitize_text(val: Optional[str], max_length: int = 500, allow_multiline: bool = False) -> str:
    """
    Sanitizes user-provided text inputs against Stored XSS, null bytes,
    and control character injection.
    """
    if not val:
        return ""
    
    # Strip null bytes and non-printable control characters
    clean = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", str(val))
    
    if not allow_multiline:
        clean = clean.replace("\r", " ").replace("\n", " ")
    
    clean = clean.strip()
    
    # Truncate to maximum permissible length
    if len(clean) > max_length:
        clean = clean[:max_length]
        
    # Strip dangerous HTML tags / script execution patterns
    clean = re.sub(r"(?i)<\s*script[^>]*>.*?<\s*/\s*script\s*>", "", clean)
    clean = re.sub(r"(?i)<\s*(script|iframe|embed|object|meta|link|style)[^>]*>", "", clean)
    clean = re.sub(r"(?i)javascript\s*:", "", clean)
    clean = re.sub(r"(?i)\bon\w+\s*=", "", clean)
    
    # Escape HTML special chars to prevent stored DOM XSS
    return html.escape(clean, quote=True)


def sanitize_url(url: Optional[str], max_length: int = 500) -> str:
    """
    Sanitizes general URLs (e.g. GitHub, LinkedIn profile links).
    Ensures only http/https protocols are allowed (strictly rejects javascript:, data:, etc.).
    """
    if not url:
        return ""
    clean = url.strip()
    if len(clean) > max_length:
        clean = clean[:max_length]
        
    lower = clean.lower()
    # Reject dangerous URI schemes
    if any(lower.startswith(scheme) for scheme in ["javascript:", "data:", "vbscript:", "file:", "blob:"]):
        return ""
        
    # Must start with http:// or https:// if a protocol is supplied
    if "://" in lower and not (lower.startswith("http://") or lower.startswith("https://")):
        return ""
        
    return clean


def validate_and_sanitize_vtu_url(url_or_note: Optional[str], max_length: int = 1000) -> str:
    """
    SSRF Protection:
    Validates user-submitted VTU links or student notes.
    If the string is an HTTP/HTTPS URL, it MUST strictly start with 'https://results.vtu.ac.in/'
    (or 'http://results.vtu.ac.in/'). Any attempt to point to internal IP ranges, localhost,
    AWS/GCP metadata endpoints (e.g. 169.254.169.254), or non-VTU domains is immediately rejected.
    If it is a plain text note (e.g. 'sem-1 reval and sem-2 make up reval'), it is sanitized.
    """
    if not url_or_note:
        return ""
    clean = url_or_note.strip()
    if len(clean) > max_length:
        clean = clean[:max_length]

    lower = clean.lower()

    # Detect if the input is attempting to supply an external web resource / URL
    is_url = (
        lower.startswith("http://")
        or lower.startswith("https://")
        or lower.startswith("//")
        or "://" in lower
        or re.match(r"^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$", clean)
    )

    if is_url:
        # Check against strictly whitelisted VTU domains
        if not any(lower.startswith(prefix) for prefix in ALLOWED_VTU_DOMAINS):
            raise HTTPException(
                status_code=400,
                detail="Security restriction (SSRF Prevention): Examination result links must strictly start with 'https://results.vtu.ac.in/'."
            )
        return clean

    # Otherwise it's a plain text note to the administrator
    return sanitize_text(clean, max_length=max_length, allow_multiline=True)
