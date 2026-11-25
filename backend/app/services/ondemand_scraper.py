import asyncio
import base64
import os
import sys
import time
import uuid
import traceback
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple

class ProactorLoopThread:
    """
    Dedicated worker thread running asyncio.ProactorEventLoop on Windows.
    This permanently eliminates the Windows SelectorEventLoop limitation
    in Uvicorn (--reload) where asyncio.create_subprocess_exec raises NotImplementedError.
    """
    def __init__(self):
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._ready = threading.Event()

    def ensure_started(self):
        if self._loop and self._loop.is_running():
            return

        def _worker():
            if sys.platform == "win32":
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
                self._loop = asyncio.ProactorEventLoop()
            else:
                self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            self._ready.set()
            self._loop.run_forever()

        self._thread = threading.Thread(target=_worker, daemon=True, name="PlaywrightProactorThread")
        self._thread.start()
        self._ready.wait()

    async def run(self, coro):
        self.ensure_started()
        assert self._loop is not None
        fut = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return await asyncio.wrap_future(fut)

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
        context: BrowserContext,
        page: Page,
        target_url: str,
        student_usn: str,
        is_self_scrape: bool = True,
        target_id: Optional[int] = None,
        on_close_cb: Optional[object] = None,
    ):
        self.session_id = session_id
        self.usn = usn  # Target USN being scraped on VTU
        self.semester = semester
        self.context = context
        self.page = page
        self.target_url = target_url
        self.student_usn = student_usn  # Student who is authenticating / solving
        self.is_self_scrape = is_self_scrape
        self.target_id = target_id
        self.fail_count = 0  # Failed captcha attempts (anti-lockout gate)
        self.created_at = time.time()
        self.last_alert_msg = {"text": ""}
        self.on_close_cb = on_close_cb
        self._is_closed = False

    async def close(self):
        if self._is_closed:
            return
        self._is_closed = True
        try:
            await self.context.close()
        except Exception:
            pass
        if self.on_close_cb:
            try:
                self.on_close_cb()
            except Exception:
                pass


class OnDemandScraperManager:
    def __init__(self):
        self._sessions: Dict[str, OnDemandSession] = {}
        self._lock = threading.Lock()
        self._worker_loop = ProactorLoopThread()
        self._reserved_usns: set = set()
        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._semaphore: Optional[asyncio.Semaphore] = None
        self._browser_lock: Optional[asyncio.Lock] = None

    async def _ensure_browser(self) -> Browser:
        """
        Guarantees a persistent single Chromium browser process is running on the worker loop.
        Initializes an asyncio.Semaphore to throttle active browser sessions to max concurrent slots.
        """
        if self._semaphore is None:
            max_concurrent = getattr(settings, "MAX_CONCURRENT_SCRAPERS", 5)
            self._semaphore = asyncio.Semaphore(max_concurrent)
        if self._browser_lock is None:
            self._browser_lock = asyncio.Lock()

        if self._browser and self._browser.is_connected():
            return self._browser

        async with self._browser_lock:
            if self._browser and self._browser.is_connected():
                return self._browser

            if self._browser:
                try:
                    await self._browser.close()
                except Exception:
                    pass
                self._browser = None

            if not self._playwright:
                self._playwright = await async_playwright().start()

            launch_args = [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-zygote",
                "--disable-extensions",
                "--disable-default-apps",
                "--mute-audio",
                "--no-default-browser-check",
                "--js-flags=--max-old-space-size=128",
                "--disable-blink-features=AutomationControlled",
                "--ignore-certificate-errors",
                "--ignore-certificate-errors-spki-list",
            ]
            try:
                self._browser = await self._playwright.chromium.launch(
                    headless=True,
                    args=launch_args,
                )
            except Exception as launch_err:
                err_msg = str(launch_err)
                if "Executable doesn't exist" in err_msg or "playwright install" in err_msg:
                    proc = await asyncio.create_subprocess_exec(
                        sys.executable, "-m", "playwright", "install", "chromium"
                    )
                    await proc.wait()
                    self._browser = await self._playwright.chromium.launch(
                        headless=True,
                        args=launch_args,
                    )
                else:
                    raise launch_err

            return self._browser

    async def _cleanup_expired(self):
        """Purge sessions older than 5 minutes to avoid browser context and semaphore leaks."""
        now = time.time()
        with self._lock:
            expired_ids = [
                sid for sid, s in self._sessions.items()
                if now - s.created_at > 300
            ]
            expired_sessions = [self._sessions.pop(sid) for sid in expired_ids if sid in self._sessions]
            for s in expired_sessions:
                self._reserved_usns.discard(s.usn)

        for session in expired_sessions:
            try:
                await session.close()
            except Exception:
                pass

    def get_next_scrape_target(self, db: Session) -> Optional[Tuple[ScrapeTarget, str]]:
        """
        Finds the next unscraped USN from the administrator's queued ScrapeTargets.
        Sequential range progression: from start_usn to end_usn.
        Filters out USNs that are currently active or reserved in in-flight sessions so concurrent
        users are assigned distinct USNs simultaneously.
        """
        with self._lock:
            in_flight_usns = {s.usn for s in self._sessions.values()} | set(self._reserved_usns)

        targets = db.query(ScrapeTarget).filter(
            ScrapeTarget.status == "PENDING"
        ).order_by(ScrapeTarget.id.asc()).all()

        for target in targets:
            usn_list = generate_usn_range(target.start_usn, target.end_usn)
            start_idx = 0
            if target.current_usn_index and target.current_usn_index in usn_list:
                start_idx = usn_list.index(target.current_usn_index)

            # Look for the next USN in range (respecting force_update / revaluation mode)
            target_sem = str(target.semester or "1").strip()
            is_force = bool(getattr(target, "force_update", False))
            found_usn = None
            for candidate in usn_list[start_idx:]:
                if candidate in in_flight_usns:
                    continue
                if is_force:
                    # Force Update / Revaluation mode: Sequential extraction through range without skipping
                    found_usn = candidate
                    break
                else:
                    has_marks = db.query(Mark.id).filter(
                        Mark.usn == candidate,
                        Mark.semester == target_sem
                    ).first()
                    if not has_marks:
                        found_usn = candidate
                        break

            if found_usn:
                with self._lock:
                    self._reserved_usns.add(found_usn)
                target.current_usn_index = found_usn
                db.commit()
                return target, found_usn
            else:
                if is_force:
                    # In force mode, if all USNs from start_idx were processed, mark completed
                    if start_idx >= len(usn_list) - 1:
                        target.status = "COMPLETED"
                        target.completed_at = datetime.utcnow()
                        db.commit()
                else:
                    # Check if all USNs in this range have marks
                    all_have_marks = True
                    for candidate in usn_list:
                        if not db.query(Mark.id).filter(Mark.usn == candidate, Mark.semester == target_sem).first():
                            all_have_marks = False
                            break
                    if all_have_marks:
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
        return await self._worker_loop.run(
            self._start_session_internal(
                target_usn=target_usn,
                semester=semester,
                target_url=target_url,
                student_usn=student_usn,
                is_self_scrape=is_self_scrape,
                target_id=target_id,
            )
        )

    async def _start_session_internal(
        self,
        target_usn: str,
        semester: str = "1",
        target_url: Optional[str] = None,
        student_usn: Optional[str] = None,
        is_self_scrape: bool = True,
        target_id: Optional[int] = None,
    ) -> dict:
        """
        Uses persistent single Chromium process, creates a lightweight BrowserContext (~10MB),
        and strictly limits active sessions to max 3 via asyncio.Semaphore(3).
        """
        clean_target_usn = target_usn.strip().upper()
        clean_student_usn = (student_usn or clean_target_usn).strip().upper()
        await self._cleanup_expired()

        # Check if server is already serving 5 captchas to 5 users
        with self._lock:
            active_sessions_count = len([s for s in self._sessions.values() if not getattr(s, "is_closed", False)])
        if active_sessions_count >= getattr(settings, "MAX_CONCURRENT_SCRAPERS", 5):
            with self._lock:
                self._reserved_usns.discard(clean_target_usn)
            return {
                "ok": False,
                "server_busy": True,
                "retry_after": 60,
                "usn": clean_target_usn,
                "message": "Service is under load. Server is currently serving 5 users. Please wait 1 minute.",
            }

        browser = await self._ensure_browser()

        # Strict Concurrency Throttle: acquire 1 of 5 concurrent browser slots with short timeout (no 30s hang)
        try:
            assert self._semaphore is not None
            await asyncio.wait_for(self._semaphore.acquire(), timeout=1.5)
        except asyncio.TimeoutError:
            with self._lock:
                self._reserved_usns.discard(clean_target_usn)
            return {
                "ok": False,
                "server_busy": True,
                "retry_after": 60,
                "usn": clean_target_usn,
                "message": "Service is under load. Server is currently serving 5 users. Please wait 1 minute.",
            }

        slot_acquired = True

        def release_slot():
            nonlocal slot_acquired
            if slot_acquired:
                slot_acquired = False
                with self._lock:
                    self._reserved_usns.discard(clean_target_usn)
                if self._semaphore:
                    try:
                        self._semaphore.release()
                    except Exception:
                        pass

        if not target_url or not target_url.strip():
            target_url = settings.VTU_URL_SEM1

        # Normalize URL to index.php
        if "resultpage.php" in target_url:
            target_url = target_url.replace("resultpage.php", "index.php")
        elif not target_url.endswith(".php"):
            target_url = target_url.rstrip("/") + "/index.php"

        session_id = str(uuid.uuid4())
        context: Optional[BrowserContext] = None
        page: Optional[Page] = None
        session: Optional[OnDemandSession] = None

        try:
            # Lightweight context: isolated cookies & storage (~10MB instead of 100MB+)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ignore_https_errors=True,
            )
            page = await context.new_page()

            session = OnDemandSession(
                session_id=session_id,
                usn=clean_target_usn,
                semester=semester,
                context=context,
                page=page,
                target_url=target_url,
                student_usn=clean_student_usn,
                is_self_scrape=is_self_scrape,
                target_id=target_id,
                on_close_cb=release_slot,
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

            with self._lock:
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
            if session:
                await session.close()
            else:
                if context:
                    try:
                        await context.close()
                    except Exception:
                        pass
                release_slot()

            return {
                "ok": False,
                "usn": clean_target_usn,
                "message": "VTU examination servers are currently busy or slow. Please try again in a few moments.",
            }

    async def refresh_captcha(self, session_id: str) -> dict:
        return await self._worker_loop.run(
            self._refresh_captcha_internal(session_id)
        )

    async def _refresh_captcha_internal(self, session_id: str) -> dict:
        """Captures a fresh screenshot of the captcha if the user finds it blurry or difficult."""
        with self._lock:
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

    async def submit_update_captcha(
        self,
        session_id: str,
        captcha_code: str,
        client_ip: str = "unknown"
    ) -> dict:
        return await self._worker_loop.run(
            self._submit_update_captcha_internal(
                session_id=session_id,
                captcha_code=captcha_code,
                client_ip=client_ip,
            )
        )

    async def _submit_update_captcha_internal(
        self,
        session_id: str,
        captcha_code: str,
        client_ip: str = "unknown"
    ) -> dict:
        """
        Submits solved captcha for an authenticated student's self-service record update.
        Upserts marks into DB without modifying the student's password or account credentials.
        """
        with self._lock:
            session = self._sessions.get(session_id)

        if not session:
            return {
                "ok": False,
                "reason": "session_expired",
                "message": "Verification session expired. Please start again.",
            }

        clean_captcha = captcha_code.strip()
        if not clean_captcha:
            return {
                "ok": False,
                "reason": "invalid_captcha",
                "message": "Please enter the verification code.",
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
                    "message": "Incorrect verification code. Please try again.",
                    "new_captcha_base64": new_b64,
                }

            # Check if results not available / seat number not found
            if "not available" in alert_lower or "not found" in alert_lower or "check the usn" in alert_lower or "not yet available" in text_lower:
                with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()
                return {
                    "ok": False,
                    "reason": "not_found",
                    "message": "No updated records found on this examination portal for your USN.",
                }

            # Marksheet Extracted Successfully!
            parsed = parse_vtu_html(content)
            if parsed and parsed.get("marks"):
                if not parsed["student"].get("usn"):
                    parsed["student"]["usn"] = session.usn

                # Save extracted marksheet into database (intelligent upsert)
                scraper_worker._save_result(parsed, session.semester)

                with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()

                return {
                    "ok": True,
                    "message": "Academic records updated successfully.",
                    "usn": session.usn,
                }
            else:
                session.fail_count += 1
                with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()
                return {
                    "ok": False,
                    "reason": "parsing_failed",
                    "message": "Could not read result table from examination portal. Please verify if results are published.",
                }

        except Exception as e:
            traceback.print_exc()
            with self._lock:
                self._sessions.pop(session_id, None)
            await session.close()
            return {
                "ok": False,
                "reason": "error",
                "message": f"Connection error: {str(e)}",
            }

    async def submit_captcha(
        self,
        session_id: str,
        captcha_code: str,
        password: str,
        client_ip: str = "unknown"
    ) -> dict:
        return await self._worker_loop.run(
            self._submit_captcha_internal(
                session_id=session_id,
                captcha_code=captcha_code,
                password=password,
                client_ip=client_ip,
            )
        )

    async def _submit_captcha_internal(
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
        with self._lock:
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

                # If student reaches 3 failed attempts, close session and prompt to refresh/login again
                if session.fail_count >= 3:
                    with self._lock:
                        self._sessions.pop(session_id, None)
                    await session.close()

                    return {
                        "ok": False,
                        "bypassed": False,
                        "reason": "max_attempts_exceeded",
                        "fail_count": session.fail_count,
                        "message": "Maximum of 3 attempts reached. Please refresh the captcha or return to login and try again.",
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
                    "message": "Invalid captcha code. Please try again.",
                    "new_captcha_base64": new_b64,
                }

            # If target results not available on VTU:
            if "not available" in alert_lower or "not found" in alert_lower or "check the usn" in alert_lower or "not yet available" in text_lower:
                session.fail_count += 1
                with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()

                # If crowdsourced, student shouldn't be blocked if the other person's result isn't announced
                if not session.is_self_scrape:
                    # Advance target queue so next student gets the next USN in the range
                    if session.target_id:
                        db = SessionLocal()
                        try:
                            target = db.query(ScrapeTarget).filter(ScrapeTarget.id == session.target_id).first()
                            if target:
                                usn_list = generate_usn_range(target.start_usn, target.end_usn)
                                try:
                                    curr_idx = usn_list.index(session.usn)
                                    if curr_idx + 1 < len(usn_list):
                                        target.current_usn_index = usn_list[curr_idx + 1]
                                    else:
                                        target.status = "COMPLETED"
                                        target.completed_at = datetime.utcnow()
                                except ValueError:
                                    pass
                                db.commit()
                        finally:
                            db.close()

                    auth_resp = self._authenticate_student_directly(session.student_usn, client_ip)
                    return {
                        "ok": True,
                        "bypassed": True,
                        "target_usn": session.usn,
                        "portal_url": session.target_url,
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

                # Advance ScrapeTarget index to the NEXT USN in the queue!
                if session.target_id:
                    db = SessionLocal()
                    try:
                        target = db.query(ScrapeTarget).filter(ScrapeTarget.id == session.target_id).first()
                        if target:
                            usn_list = generate_usn_range(target.start_usn, target.end_usn)
                            try:
                                curr_idx = usn_list.index(session.usn)
                                if curr_idx + 1 < len(usn_list):
                                    target.current_usn_index = usn_list[curr_idx + 1]
                                else:
                                    target.current_usn_index = session.usn
                                    target.status = "COMPLETED"
                                    target.completed_at = datetime.utcnow()
                            except ValueError:
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
                target_scraped_usn = session.usn
                portal_scraped_url = session.target_url
                with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()

                return {
                    "ok": True,
                    "bypassed": False,
                    "target_usn": target_scraped_usn,
                    "portal_url": portal_scraped_url,
                    "auth_response": auth_resp,
                    "message": "Security verification successful! Access granted.",
                }

            else:
                # Could not parse table
                session.fail_count += 1
                with self._lock:
                    self._sessions.pop(session_id, None)
                await session.close()

                return {
                    "ok": False,
                    "bypassed": False,
                    "reason": "parsing_failed",
                    "fail_count": session.fail_count,
                    "message": "Maximum attempts reached. Please refresh captcha or return to login and try again." if session.fail_count >= 3 else "Could not read VTU marks table. Please try again.",
                }

        except Exception as e:
            traceback.print_exc()
            with self._lock:
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

    async def cancel_session(self, session_id: str) -> dict:
        """Explicitly cancels an active verification session and releases semaphore slot immediately."""
        return await self._worker_loop.run(
            self._cancel_session_internal(session_id)
        )

    async def _cancel_session_internal(self, session_id: str) -> dict:
        with self._lock:
            session = self._sessions.pop(session_id, None)
            if session:
                self._reserved_usns.discard(session.usn)

        if session:
            await session.close()

        return {"ok": True, "message": "Verification session cancelled."}

    async def shutdown(self):
        """Cleanly close all browser contexts, persistent Chromium process, and Playwright worker."""
        await self._worker_loop.run(self._shutdown_internal())

    async def _shutdown_internal(self):
        with self._lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()
            self._reserved_usns.clear()

        for session in sessions:
            try:
                await session.close()
            except Exception:
                pass

        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None

        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None


ondemand_scraper = OnDemandScraperManager()
