import asyncio
import base64
import random
import re
import sys
import threading
import traceback
from typing import List, Optional
from playwright.async_api import async_playwright

from app.config import settings
from app.database import SessionLocal
from app.models import Student, Subject, Mark
from app.scraper.parser import parse_vtu_html
from app.services.job_manager import job_manager

BRANCH_MAP = {
    "CS": "CSE",
    "CD": "DS",
    "DS": "DS",
    "CY": "CY",
    "IS": "ISE",
    "CI": "AIML",
    "AI": "AIML",
    "IE": "ECE",
    "EC": "ECE",
    "EE": "EEE",
    "ME": "MECH",
    "CV": "CIVIL",
}

def extract_branch(usn: str) -> str:
    """Extracts branch name from standard USN, e.g., 1RM25CS001 -> CSE, 1RM25CD052 -> DS"""
    clean_usn = usn.strip().upper()
    if len(clean_usn) >= 7:
        code = clean_usn[5:7]
        return BRANCH_MAP.get(code, code)
    return "OTHER"

def extract_batch(usn: str) -> Optional[int]:
    """Extracts batch year from USN, e.g., 1RM25CS001 -> 2025"""
    clean_usn = usn.strip().upper()
    if len(clean_usn) >= 5 and clean_usn[3:5].isdigit():
        return 2000 + int(clean_usn[3:5])
    return None

def generate_usn_range(start_usn: str, end_usn: Optional[str] = None) -> List[str]:
    """
    Generates list of USNs between start and end (inclusive).
    Supports single USN when start == end or end is omitted.
    """
    start = start_usn.strip().upper()
    if not end_usn or not end_usn.strip() or start == end_usn.strip().upper():
        return [start]

    end = end_usn.strip().upper()

    match_start = re.match(r"^([A-Z0-9]+?)(\d+)$", start)
    match_end = re.match(r"^([A-Z0-9]+?)(\d+)$", end)

    if not match_start or not match_end:
        return [start] if start == end else [start, end]

    prefix_start, num_start_str = match_start.groups()
    prefix_end, num_end_str = match_end.groups()

    if prefix_start != prefix_end:
        return [start, end]

    num_start = int(num_start_str)
    num_end = int(num_end_str)
    pad_len = max(len(num_start_str), len(num_end_str), 3)

    if num_start > num_end:
        num_start, num_end = num_end, num_start

    return [f"{prefix_start}{str(n).zfill(pad_len)}" for n in range(num_start, num_end + 1)]


class ScraperWorker:
    def __init__(self):
        self._thread: Optional[threading.Thread] = None

    def is_active(self) -> bool:
        return bool(job_manager.is_running and self._thread and self._thread.is_alive())

    def start(self, start_usn: str, end_usn: Optional[str], semester: str, custom_url: Optional[str] = None) -> bool:
        if self.is_active():
            return False

        usn_list = generate_usn_range(start_usn, end_usn)
        if not usn_list:
            return False

        job_manager.reset(start_usn, end_usn or start_usn, len(usn_list))

        self._thread = threading.Thread(
            target=self._thread_runner,
            args=(usn_list, semester, custom_url),
            daemon=True
        )
        self._thread.start()
        return True

    def stop(self):
        job_manager.stop()

    def _thread_runner(self, usn_list: List[str], semester: str, custom_url: Optional[str] = None):
        """Dedicated background thread running its own ProactorEventLoop on Windows."""
        if sys.platform == "win32":
            loop = asyncio.ProactorEventLoop()
        else:
            loop = asyncio.new_event_loop()
        
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self._async_run_loop(usn_list, semester, custom_url))
        except Exception as e:
            err_msg = str(e).strip() or type(e).__name__
            job_manager.log(f"❌ Fatal scraper error: {err_msg} ({type(e).__name__})")
            traceback.print_exc()
            job_manager.finish(f"Scraper error: {err_msg}")
        finally:
            try:
                loop.close()
            except Exception:
                pass

    async def _async_run_loop(self, usn_list: List[str], semester: str, custom_url: Optional[str] = None):
        try:
            # Determine target URL
            if custom_url and custom_url.strip():
                target_url = custom_url.strip()
            elif semester == "2":
                target_url = settings.VTU_URL_SEM2
            else:
                target_url = settings.VTU_URL_SEM1

            # Normalization: VTU results entry form is always index.php
            if "resultpage.php" in target_url:
                target_url = target_url.replace("resultpage.php", "index.php")

            job_manager.log(f"Connecting to VTU results portal: {target_url}")

            async with async_playwright() as p:
                try:
                    browser = await p.chromium.launch(
                        headless=True,
                        args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
                    )
                except Exception as launch_err:
                    err_msg = str(launch_err).strip() or type(launch_err).__name__
                    job_manager.log(f"❌ Chromium launch error: {err_msg}. Run 'playwright install chromium' in terminal.")
                    job_manager.finish(f"Scraper halted: {err_msg}")
                    return

                context: BrowserContext = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                page: Page = await context.new_page()

                # Handle VTU JavaScript alerts
                last_alert_msg = {"text": ""}
                def handle_dialog(dialog):
                    last_alert_msg["text"] = dialog.message
                    job_manager.log(f"VTU Alert: {dialog.message}")
                    asyncio.create_task(dialog.accept())
                page.on("dialog", handle_dialog)

                for idx, usn in enumerate(usn_list):
                    if not job_manager.is_running:
                        job_manager.log("Scraping task stopped by user.")
                        break

                    job_manager.current_usn = usn
                    job_manager.processed_count = idx + 1
                    job_manager.log(f"[{idx+1}/{len(usn_list)}] Loading portal for USN: {usn}...")

                    retries = 3
                    success = False

                    while retries > 0 and job_manager.is_running and not success:
                        try:
                            last_alert_msg["text"] = ""
                            await page.goto(target_url, wait_until="domcontentloaded", timeout=25000)

                            # Find USN input field
                            usn_input = await page.wait_for_selector(
                                'input[name="lns"], input[name="usn"], #usn, #lns, input[placeholder*="USN" i], input[type="text"]',
                                timeout=10000
                            )
                            if not usn_input:
                                job_manager.log("❌ Could not find USN input box on portal page.")
                                break

                            # Type USN with natural keystroke delay
                            await usn_input.fill("")
                            await usn_input.type(usn, delay=40)

                            # Locate Captcha image
                            captcha_el = await page.wait_for_selector(
                                'img[src*="captcha" i], img[src*="code" i], img[id*="captcha" i], #captchaimg, form img',
                                timeout=8000
                            )
                            if not captcha_el:
                                job_manager.log("❌ No captcha image found on portal page.")
                                break

                            # Screenshot captcha image
                            captcha_bytes = await captcha_el.screenshot()
                            captcha_b64 = base64.b64encode(captcha_bytes).decode("utf-8")

                            # Request Admin to solve captcha
                            job_manager.request_captcha(captcha_b64, usn)

                            # Wait for admin captcha submission in a non-blocking way
                            await asyncio.to_thread(job_manager.captcha_event.wait)

                            if not job_manager.is_running:
                                break

                            entered_captcha = job_manager.captcha_input or ""
                            if not entered_captcha:
                                job_manager.log("⚠️ Empty captcha entered. Skipping.")
                                break

                            # Fill captcha field
                            captcha_input = await page.query_selector(
                                'input[name="captchacode"], input[name="captcha"], input[id="captchacode"], input[id="captcha"], input[placeholder*="captcha" i]'
                            )
                            if captcha_input:
                                await captcha_input.fill("")
                                await captcha_input.type(entered_captcha, delay=40)

                            # Locate submit button
                            submit_btn = await page.query_selector(
                                'input[type="submit"], button[type="submit"], #submit, input[value*="SUBMIT" i]'
                            )

                            # Click submit and properly wait for navigation or new tab
                            if submit_btn:
                                await submit_btn.click()
                            else:
                                await page.keyboard.press("Enter")

                            # Wait for page navigation / response
                            try:
                                await page.wait_for_load_state("load", timeout=12000)
                            except Exception:
                                pass

                            await asyncio.sleep(1.5)

                            # Check if a new popup tab opened
                            active_page = page
                            if len(context.pages) > 1:
                                active_page = context.pages[-1]
                                job_manager.log(f"Switched to result popup tab: {active_page.url}")

                            # Check if JavaScript alert popped up
                            alert_lower = last_alert_msg["text"].lower()
                            if "captcha" in alert_lower:
                                job_manager.log(f"⚠️ Invalid Captcha for {usn}. Refreshing captcha...")
                                retries -= 1
                                continue
                            elif "not available" in alert_lower or "not found" in alert_lower or "check the usn" in alert_lower:
                                job_manager.log(f"ℹ️ VTU Alert: {last_alert_msg['text']}")
                                success = True
                                break

                            # Get content and parse
                            content = await active_page.content()
                            job_manager.log(f"Result URL: {active_page.url} (title: '{await active_page.title()}')")

                            # Check for in-page error messages
                            text_lower = content.lower()
                            if "invalid captcha" in text_lower or "captcha code is not matching" in text_lower:
                                job_manager.log(f"⚠️ Captcha did not match for {usn}. Retrying...")
                                retries -= 1
                                continue

                            parsed = parse_vtu_html(content)

                            if parsed["marks"]:
                                if not parsed["student"].get("usn"):
                                    parsed["student"]["usn"] = usn

                                self._save_result(parsed, semester)
                                job_manager.log(
                                    f"✅ Saved {usn} ({parsed['student'].get('name', 'Student')}): "
                                    f"{parsed['total_marks']}/{parsed['max_marks']} marks, "
                                    f"{parsed['total_backlogs']} backlogs, {len(parsed['marks'])} subjects."
                                )
                                success = True
                            else:
                                # Save HTML snapshot for debugging
                                try:
                                    with open("debug_vtu_response.html", "w", encoding="utf-8") as f:
                                        f.write(content)
                                    job_manager.log(f"ℹ️ Could not extract marks table (saved debug snapshot). URL: {active_page.url}")
                                except Exception:
                                    pass

                                job_manager.log(f"ℹ️ Results not published or table structure different for {usn}.")
                                success = True  # Move to next USN

                        except Exception as err:
                            err_str = str(err).strip() or type(err).__name__
                            job_manager.log(f"⚠️ Error on {usn} (attempt {4-retries}): {err_str}")
                            retries -= 1
                            await asyncio.sleep(2)

                    # Politeness delay before next USN
                    if job_manager.is_running and idx + 1 < len(usn_list):
                        delay = random.uniform(settings.DELAY_MIN, settings.DELAY_MAX)
                        job_manager.log(f"Waiting {delay:.1f}s before checking next USN...")
                        await asyncio.sleep(delay)

                await browser.close()
                job_manager.finish("Scraping job completed.")

        except Exception as fatal_e:
            err_msg = str(fatal_e).strip() or type(fatal_e).__name__
            job_manager.log(f"❌ Fatal scraper error: {err_msg} ({type(fatal_e).__name__})")
            traceback.print_exc()
            job_manager.finish(f"Scraper error: {err_msg}")

    def _save_result(self, parsed: dict, semester: str):
        """Persists extracted student and mark records in database."""
        db = SessionLocal()
        try:
            usn = parsed["student"]["usn"].strip().upper()
            name = parsed["student"].get("name", "").strip() or usn
            branch = extract_branch(usn)
            batch = extract_batch(usn)

            student = db.query(Student).filter(Student.usn == usn).first()
            if not student:
                student = Student(usn=usn)
                db.add(student)

            student.name = name
            student.branch = branch
            student.batch = batch
            student.total_marks = parsed["total_marks"]
            student.max_marks = parsed["max_marks"]
            student.percentage = parsed["percentage"]
            student.total_backlogs = parsed["total_backlogs"]

            # Clear previous marks for this student and semester to prevent duplicate records
            db.query(Mark).filter(Mark.usn == usn, Mark.semester == semester).delete()

            for m in parsed["marks"]:
                code = m["subject_code"].strip().upper()
                subj = db.query(Subject).filter(Subject.code == code).first()
                if not subj:
                    subj = Subject(code=code, name=m["subject_name"])
                    db.add(subj)
                elif m["subject_name"] and not subj.name:
                    subj.name = m["subject_name"]

                mark = Mark(
                    usn=usn,
                    subject_code=code,
                    semester=semester,
                    internal_marks=m["internal_marks"],
                    external_marks=m["external_marks"],
                    total=m["total"],
                    max_marks=m["max_marks"],
                    status=m["status"],
                )
                db.add(mark)

            db.commit()
        except Exception as e:
            db.rollback()
            job_manager.log(f"Database error saving {usn}: {str(e)}")
        finally:
            db.close()

scraper_worker = ScraperWorker()
