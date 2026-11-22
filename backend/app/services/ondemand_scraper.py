import asyncio
import base64
import os
import sys
import time
import uuid
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

# Ensure persistent Playwright cache on Linux / Render hosts
if "PLAYWRIGHT_BROWSERS_PATH" not in os.environ and sys.platform != "win32":
    if Path("/opt/render/project/src").exists():
        render_cache = Path("/opt/render/project/src/.cache/ms-playwright")
        render_cache.mkdir(parents=True, exist_ok=True)
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(render_cache)
    else:
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "0"

from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright

from ..config import settings
from ..database import SessionLocal
from ..models import Student, LoginLog
from ..auth import hash_password, create_session
from ..scraper.parser import parse_vtu_html
from ..scraper.worker import scraper_worker


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
    ):
        self.session_id = session_id
        self.usn = usn
        self.semester = semester
        self.playwright = playwright
        self.browser = browser
        self.context = context
        self.page = page
        self.target_url = target_url
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

    async def start_session(
        self,
        usn: str,
        semester: str = "1",
        target_url: Optional[str] = None
    ) -> dict:
        """
        Launches an isolated Playwright browser instance, navigates to the VTU portal,
        fills the student's USN, takes a screenshot of the live captcha, and returns
        the session ID and base64 captcha image.
        """
        clean_usn = usn.strip().upper()
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

            # Launch Chromium with anti-detection flags
            try:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-blink-features=AutomationControlled",
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
                        ],
                    )
                else:
                    raise launch_err

            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()

            session = OnDemandSession(
                session_id=session_id,
                usn=clean_usn,
                semester=semester,
                playwright=p,
                browser=browser,
                context=context,
                page=page,
                target_url=target_url,
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
                    "usn": clean_usn,
                    "message": "Could not find USN input box on VTU portal. VTU servers may be down or slow.",
                }

            # Type USN
            await usn_input.fill("")
            await usn_input.type(clean_usn, delay=35)

            # Locate Captcha image element
            captcha_el = await page.wait_for_selector(
                'img[src*="captcha" i], img[src*="code" i], img[id*="captcha" i], #captchaimg, form img',
                timeout=10000,
            )
            if not captcha_el:
                await session.close()
                return {
                    "ok": False,
                    "usn": clean_usn,
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
                "usn": clean_usn,
                "message": "Captcha generated successfully from VTU portal.",
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
                "usn": clean_usn,
                "message": f"Connection to VTU portal timed out or failed ({err_msg}). VTU might be under heavy load.",
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
                # Reload page and re-enter USN
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
        Submits the student's solved captcha to the active Playwright session,
        extracts marks, saves student record into DB, registers password, and logs student in.
        """
        async with self._lock:
            session = self._sessions.get(session_id)

        if not session:
            return {
                "ok": False,
                "reason": "session_expired",
                "message": "Verification session expired. Please request a new captcha.",
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

            # 1. Check for VTU JavaScript alert dialog
            alert_text = session.last_alert_msg["text"].strip()
            alert_lower = alert_text.lower()
            if "captcha" in alert_lower:
                # Capture new captcha screenshot
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
                    "message": f"VTU Alert: {alert_text or 'Invalid captcha code'}. Please try again with the new image.",
                    "new_captcha_base64": new_b64,
                }
            elif "not available" in alert_lower or "not found" in alert_lower or "check the usn" in alert_lower:
                async with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()
                return {
                    "ok": False,
                    "reason": "not_found",
                    "message": f"VTU Alert: {alert_text}",
                }

            # 2. Check page HTML content
            content = await active_page.content()
            text_lower = content.lower()

            if "invalid captcha" in text_lower or "captcha code is not matching" in text_lower:
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
                    "message": "Captcha code was incorrect or expired. Please solve the updated captcha.",
                    "new_captcha_base64": new_b64,
                }

            # 3. Parse VTU marksheet HTML
            parsed = parse_vtu_html(content)

            if parsed["marks"]:
                if not parsed["student"].get("usn"):
                    parsed["student"]["usn"] = session.usn

                # Persist extracted results into database using intelligent upsert
                scraper_worker._save_result(parsed, session.semester)

                # Now lock student account with password and create session
                db = SessionLocal()
                try:
                    student = db.query(Student).filter(Student.usn == session.usn).first()
                    if not student:
                        raise Exception("Failed to query created student record.")

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

                    res_data = {
                        "ok": True,
                        "status": "registered",
                        "token": token,
                        "usn": student.usn,
                        "name": student.name,
                        "branch": student.branch,
                        "login_count": 1,
                        "total_marks": student.total_marks,
                        "max_marks": student.max_marks,
                        "percentage": student.percentage,
                        "message": f"Successfully extracted marksheet for {student.name}!",
                    }
                finally:
                    db.close()

                # Clean up Playwright session
                async with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()

                return res_data

            else:
                # Check if results not yet announced
                async with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()

                if "not yet available" in text_lower or "check the usn" in text_lower or "not available" in text_lower:
                    return {
                        "ok": False,
                        "reason": "not_published",
                        "message": f"Results for USN {session.usn} have not been published by VTU yet.",
                    }
                else:
                    return {
                        "ok": False,
                        "reason": "parsing_failed",
                        "message": f"VTU responded, but could not parse marks table. Please check if your USN is correct.",
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


ondemand_scraper = OnDemandScraperManager()
