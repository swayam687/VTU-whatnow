import asyncio
import base64
import os
import sys
import time
import uuid
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple

# Ensure persistent Playwright cache on Linux / Render hosts
if "PLAYWRIGHT_BROWSERS_PATH" not in os.environ and sys.platform != "win32":
    if Path("/opt/render/project/src").exists():
        render_cache = Path("/opt/render/project/src/.cache/ms-playwright")
        render_cache.mkdir(parents=True, exist_ok=True)
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(render_cache)
    else:
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "0"

from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..models import Student, Mark, LoginLog, ScrapeTarget
from ..auth import hash_password, create_session
from ..scraper.parser import parse_vtu_html
from ..scraper.worker import scraper_worker, generate_usn_range


class OnDemandSession:
    def __init__(
        self,
        session_id: str,
        usn: str,
        semester: str,
        playwright: Playwright,
        browser: Browser,
        context: BrowserContext,
        page: Page,
        target_url: str,
        student_usn: str,
        is_self_scrape: bool = True,
        target_id: Optional[int] = None,
    ):
        self.session_id = session_id
        self.usn = usn  # Target USN being scraped on VTU
        self.semester = semester
        self.playwright = playwright
        self.browser = browser
        self.context = context
        self.page = page
        self.target_url = target_url
        self.student_usn = student_usn  # Student who is authenticating / solving
        self.is_self_scrape = is_self_scrape
        self.target_id = target_id
        self.fail_count = 0  # Failed captcha attempts (anti-lockout gate)
        self.created_at = time.time()
        self.last_alert_msg = {"text": ""}

    async def close(self):
        try:
            await self.context.close()
        except Exception:
            pass
        try:
            await self.browser.close()
        except Exception:
            pass
        try:
            await self.playwright.stop()
        except Exception:
            pass


class OnDemandScraperManager:
    def __init__(self):
        self._sessions: Dict[str, OnDemandSession] = {}
        self._lock = asyncio.Lock()

    async def _cleanup_expired(self):
        """Purge sessions older than 6 minutes to avoid browser resource leaks."""
        now = time.time()
        expired_ids = [
            sid for sid, s in self._sessions.items()
            if now - s.created_at > 360
        ]
        for sid in expired_ids:
            session = self._sessions.pop(sid, None)
            if session:
                await session.close()

    def get_next_scrape_target(self, db: Session) -> Optional[Tuple[ScrapeTarget, str]]:
        """
        Finds the next unscraped USN from the administrator's queued ScrapeTargets.
        Sequential range progression: from start_usn to end_usn.
        """
        targets = db.query(ScrapeTarget).filter(
            ScrapeTarget.status == "PENDING"
        ).order_by(ScrapeTarget.id.asc()).all()

        for target in targets:
            usn_list = generate_usn_range(target.start_usn, target.end_usn)
            start_idx = 0
            if target.current_usn_index and target.current_usn_index in usn_list:
                start_idx = usn_list.index(target.current_usn_index)

            # Look for the first USN in the range not yet extracted in database
            found_usn = None
            for candidate in usn_list[start_idx:]:
                has_marks = db.query(Mark.id).filter(Mark.usn == candidate).first()
                if not has_marks:
                    found_usn = candidate
                    break

            if found_usn:
                target.current_usn_index = found_usn
                db.commit()
                return target, found_usn
            else:
                # All USNs in this range have already been scraped
                target.status = "COMPLETED"
                target.completed_at = datetime.utcnow()
                db.commit()

        return None

    async def start_session(
        self,
        target_usn: str,
        semester: str = "1",
        target_url: Optional[str] = None,
        student_usn: Optional[str] = None,
        is_self_scrape: bool = True,
        target_id: Optional[int] = None,
    ) -> dict:
        """
        Launches an isolated Playwright browser instance, navigates to the VTU portal,
        fills the target USN, captures the captcha image Base64, and records the session.
        """
        clean_target_usn = target_usn.strip().upper()
        clean_student_usn = (student_usn or clean_target_usn).strip().upper()
        await self._cleanup_expired()

        if not target_url or not target_url.strip():
            target_url = settings.VTU_URL_SEM1

        # Normalize URL to index.php
        if "resultpage.php" in target_url:
            target_url = target_url.replace("resultpage.php", "index.php")
        elif not target_url.endswith(".php"):
            target_url = target_url.rstrip("/") + "/index.php"

        session_id = str(uuid.uuid4())
        p: Optional[Playwright] = None
        browser: Optional[Browser] = None
        context: Optional[BrowserContext] = None
        page: Optional[Page] = None

        try:
            p = await async_playwright().start()

            # Launch Chromium with anti-detection flags & SSL cert bypass
            try:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-blink-features=AutomationControlled",
                        "--ignore-certificate-errors",
                        "--ignore-certificate-errors-spki-list",
                    ],
                )
            except Exception as launch_err:
                err_msg = str(launch_err)
                if "Executable doesn't exist" in err_msg or "playwright install" in err_msg:
                    import subprocess
                    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
                    browser = await p.chromium.launch(
                        headless=True,
                        args=[
                            "--no-sandbox",
                            "--disable-setuid-sandbox",
                            "--disable-blink-features=AutomationControlled",
                            "--ignore-certificate-errors",
                            "--ignore-certificate-errors-spki-list",
                        ],
                    )
                else:
                    raise launch_err

            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ignore_https_errors=True,
            )
            page = await context.new_page()

            session = OnDemandSession(
                session_id=session_id,
                usn=clean_target_usn,
                semester=semester,
                playwright=p,
                browser=browser,
                context=context,
                page=page,
                target_url=target_url,
                student_usn=clean_student_usn,
                is_self_scrape=is_self_scrape,
                target_id=target_id,
            )

            # Dialog listener for JS alerts
            async def handle_dialog(dialog):
                session.last_alert_msg["text"] = dialog.message
                try:
                    await dialog.accept()
                except Exception:
                    pass

            page.on("dialog", lambda dialog: asyncio.create_task(handle_dialog(dialog)))

            # Navigate to VTU results portal
            await page.goto(target_url, wait_until="domcontentloaded", timeout=35000)

            # Find USN input field
            usn_input = await page.wait_for_selector(
                'input[name="lns"], input[name="usn"], input[name="USN"], #usn, #lns, input[placeholder*="USN" i], input[type="text"]',
                timeout=12000,
            )
            if not usn_input:
                await session.close()
                return {
                    "ok": False,
                    "usn": clean_target_usn,
                    "message": "Could not locate USN input box on VTU portal. VTU servers may be down or slow.",
                }

            # Type target USN
            await usn_input.fill("")
            await usn_input.type(clean_target_usn, delay=35)

            # Locate Captcha image element
            captcha_el = await page.wait_for_selector(
                'img[src*="captcha" i], img[src*="code" i], img[id*="captcha" i], #captchaimg, form img',
                timeout=10000,
            )
            if not captcha_el:
                await session.close()
                return {
                    "ok": False,
                    "usn": clean_target_usn,
                    "message": "Could not find Captcha image on VTU portal. Please try again in a few moments.",
                }

            # Screenshot captcha
            captcha_bytes = await captcha_el.screenshot()
            captcha_b64 = base64.b64encode(captcha_bytes).decode("utf-8")

            async with self._lock:
                self._sessions[session_id] = session

            return {
                "ok": True,
                "session_id": session_id,
                "captcha_base64": captcha_b64,
                "target_usn": clean_target_usn,
                "student_usn": clean_student_usn,
                "is_self_scrape": is_self_scrape,
                "message": "Security verification captcha generated from VTU portal.",
            }

        except Exception as e:
            traceback.print_exc()
            err_msg = str(e).strip() or type(e).__name__
            if p or browser:
                try:
                    if context:
                        await context.close()
                    if browser:
                        await browser.close()
                    if p:
                        await p.stop()
                except Exception:
                    pass
            return {
                "ok": False,
                "usn": clean_target_usn,
                "message": f"Connection to VTU portal timed out ({err_msg}). VTU might be under heavy load.",
            }

    async def refresh_captcha(self, session_id: str) -> dict:
        """Captures a fresh screenshot of the captcha if the user finds it blurry or difficult."""
        async with self._lock:
            session = self._sessions.get(session_id)

        if not session:
            return {"ok": False, "message": "Verification session expired. Please start again."}

        try:
            page = session.page
            captcha_el = await page.query_selector(
                'img[src*="captcha" i], img[src*="code" i], img[id*="captcha" i], #captchaimg, form img'
            )
            if not captcha_el:
                await page.goto(session.target_url, wait_until="domcontentloaded", timeout=25000)
                usn_input = await page.wait_for_selector(
                    'input[name="lns"], input[name="usn"], input[name="USN"], #usn, #lns, input[placeholder*="USN" i], input[type="text"]',
                    timeout=10000,
                )
                if usn_input:
                    await usn_input.fill("")
                    await usn_input.type(session.usn, delay=35)
                captcha_el = await page.wait_for_selector(
                    'img[src*="captcha" i], img[src*="code" i], img[id*="captcha" i], #captchaimg, form img',
                    timeout=8000,
                )

            if captcha_el:
                captcha_bytes = await captcha_el.screenshot()
                captcha_b64 = base64.b64encode(captcha_bytes).decode("utf-8")
                return {"ok": True, "captcha_base64": captcha_b64}
            else:
                return {"ok": False, "message": "Could not refresh captcha image from VTU."}
        except Exception as e:
            return {"ok": False, "message": f"Failed to refresh captcha: {str(e)}"}

    async def submit_captcha(
        self,
        session_id: str,
        captcha_code: str,
        password: str,
        client_ip: str = "unknown"
    ) -> dict:
        """
        Submits the student's solved captcha to VTU.
        - If self-scrape: saves marks for student and locks password.
        - If crowdsourced gate: saves marks for target USN, marks target queue progress,
          and logs the authenticated student into their dashboard.
        - Anti-Lockout: tracks failed attempts; if fails >= 3, bypasses gate and logs student in.
        """
        async with self._lock:
            session = self._sessions.get(session_id)

        if not session:
            return {
                "ok": False,
                "reason": "session_expired",
                "message": "Verification session expired. Please try again.",
            }

        clean_captcha = captcha_code.strip()
        if not clean_captcha:
            return {
                "ok": False,
                "reason": "invalid_captcha",
                "message": "Please enter the captcha code.",
            }

        page = session.page
        context = session.context
        session.last_alert_msg["text"] = ""
        active_page = page

        try:
            # Fill captcha field
            captcha_input = await page.query_selector(
                'input[name="captchacode"], input[name="captcha"], input[name*="code" i], input[id="captchacode"], input[id="captcha"], input[placeholder*="captcha" i]'
            )
            if captcha_input:
                await captcha_input.fill("")
                await captcha_input.type(clean_captcha, delay=35)

            # Locate submit button
            submit_btn = await page.query_selector(
                'input[type="submit"], button[type="submit"], #submit, input[value*="SUBMIT" i], button:has-text("Submit"), input[id="submit"]'
            )
            if submit_btn:
                await submit_btn.click()
            else:
                await page.keyboard.press("Enter")

            # Wait for response / load
            try:
                await page.wait_for_load_state("load", timeout=15000)
            except Exception:
                pass

            await asyncio.sleep(1.5)

            # Check if popup tab opened
            if len(context.pages) > 1:
                active_page = context.pages[-1]

            # Wait up to 6s for the result table or marks section to render
            try:
                await active_page.wait_for_selector(
                    "table, .divTable, .divTableRow, b:has-text('Semester'), text='University Seat Number'",
                    timeout=6000,
                )
            except Exception:
                pass

            # -------------------------------------------------------------
            # Handle Captcha Failures & Fallback Anti-Lockout Gate
            # -------------------------------------------------------------
            alert_text = session.last_alert_msg["text"].strip()
            alert_lower = alert_text.lower()
            content = await active_page.content()
            text_lower = content.lower()

            is_captcha_fail = (
                "captcha" in alert_lower
                or "invalid captcha" in text_lower
                or "captcha code is not matching" in text_lower
            )

            if is_captcha_fail:
                session.fail_count += 1

                # CRITICAL FALLBACK (Anti-Lockout):
                # If student fails 3 times on a crowdsourced verification gate,
                # bypass gate and grant login with cached data so they are not blocked.
                if session.fail_count >= 3 and not session.is_self_scrape:
                    async with self._lock:
                        self._sessions.pop(session_id, None)
                    await session.close()

                    # Authenticate student directly
                    auth_resp = self._authenticate_student_directly(session.student_usn, client_ip)
                    return {
                        "ok": True,
                        "bypassed": True,
                        "fail_count": session.fail_count,
                        "auth_response": auth_resp,
                        "message": "VTU servers are currently unresponsive. Logging you in with cached data.",
                    }

                # Otherwise, fetch new captcha for next attempt
                new_b64 = None
                try:
                    c_el = await page.query_selector('img[src*="captcha" i], img[src*="code" i], #captchaimg, form img')
                    if c_el:
                        new_bytes = await c_el.screenshot()
                        new_b64 = base64.b64encode(new_bytes).decode("utf-8")
                except Exception:
                    pass

                return {
                    "ok": False,
                    "reason": "invalid_captcha",
                    "fail_count": session.fail_count,
                    "message": f"VTU Alert: {alert_text or 'Incorrect captcha code'}. Please try again.",
                    "new_captcha_base64": new_b64,
                }

            # If target results not available on VTU:
            if "not available" in alert_lower or "not found" in alert_lower or "check the usn" in alert_lower or "not yet available" in text_lower:
                session.fail_count += 1
                async with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()

                # If crowdsourced, student shouldn't be blocked if the other person's result isn't announced
                if not session.is_self_scrape:
                    auth_resp = self._authenticate_student_directly(session.student_usn, client_ip)
                    return {
                        "ok": True,
                        "bypassed": True,
                        "fail_count": session.fail_count,
                        "auth_response": auth_resp,
                        "message": "Verification completed. Campus records updated.",
                    }
                else:
                    return {
                        "ok": False,
                        "reason": "not_found",
                        "message": f"Results for USN {session.usn} have not been published by VTU yet.",
                    }

            # -------------------------------------------------------------
            # Marksheet Extracted Successfully!
            # -------------------------------------------------------------
            parsed = parse_vtu_html(content)
            if parsed["marks"]:
                if not parsed["student"].get("usn"):
                    parsed["student"]["usn"] = session.usn

                # Save extracted marksheet into database
                scraper_worker._save_result(parsed, session.semester)

                # Advance ScrapeTarget index if this was a crowdsourced job
                if session.target_id:
                    db = SessionLocal()
                    try:
                        target = db.query(ScrapeTarget).filter(ScrapeTarget.id == session.target_id).first()
                        if target:
                            target.current_usn_index = session.usn
                            db.commit()
                    finally:
                        db.close()

                # Case A: Self-Scrape (student is new, register their account)
                if session.is_self_scrape:
                    db = SessionLocal()
                    try:
                        student = db.query(Student).filter(Student.usn == session.student_usn).first()
                        if student:
                            student.password_hash = hash_password(password)
                            student.is_claimed = True
                            student.login_count = 1
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
                            auth_resp = {
                                "ok": True,
                                "status": "registered",
                                "token": token,
                                "usn": student.usn,
                                "name": student.name,
                                "branch": student.branch,
                                "login_count": 1,
                            }
                        else:
                            auth_resp = None
                    finally:
                        db.close()

                # Case B: Crowdsourced Login Gate (student already exists, log them in!)
                else:
                    auth_resp = self._authenticate_student_directly(session.student_usn, client_ip)

                # Clean up Playwright session
                async with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()

                return {
                    "ok": True,
                    "bypassed": False,
                    "auth_response": auth_resp,
                    "message": "Security verification successful! Access granted.",
                }

            else:
                # Could not parse table
                session.fail_count += 1
                async with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()

                if not session.is_self_scrape and session.fail_count >= 3:
                    auth_resp = self._authenticate_student_directly(session.student_usn, client_ip)
                    return {
                        "ok": True,
                        "bypassed": True,
                        "auth_response": auth_resp,
                        "message": "VTU servers are currently unresponsive. Logging you in with cached data.",
                    }

                return {
                    "ok": False,
                    "reason": "parsing_failed",
                    "fail_count": session.fail_count,
                    "message": "Could not read VTU marks table. Please try again.",
                }

        except Exception as e:
            traceback.print_exc()
            async with self._lock:
                self._sessions.pop(session_id, None)
            await session.close()
            return {
                "ok": False,
                "reason": "error",
                "message": f"Error during VTU extraction: {str(e)}",
            }

    def _authenticate_student_directly(self, usn: str, client_ip: str) -> dict:
        """Helper to create session token and record login for an authenticated student."""
        db = SessionLocal()
        try:
            student = db.query(Student).filter(Student.usn == usn.strip().upper()).first()
            if not student:
                return {"ok": False, "message": "Student record not found."}

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
            return {
                "ok": True,
                "status": "authenticated",
                "token": token,
                "usn": student.usn,
                "name": student.name,
                "branch": student.branch,
                "login_count": student.login_count,
            }
        finally:
            db.close()


ondemand_scraper = OnDemandScraperManager()
