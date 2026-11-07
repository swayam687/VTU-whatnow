import threading
from typing import List, Optional

class JobManager:
    def __init__(self):
        self.is_running: bool = False
        self.status: str = "idle"  # idle, running, waiting_captcha, finished, stopped, error
        self.status_message: str = "Ready to scrape"
        self.current_usn: Optional[str] = None
        self.start_usn: Optional[str] = None
        self.end_usn: Optional[str] = None
        self.processed_count: int = 0
        self.total_count: int = 0
        
        # Interactive Captcha HITL (threading.Event works safely across threads)
        self.captcha_base64: Optional[str] = None
        self.captcha_input: Optional[str] = None
        self.captcha_event: threading.Event = threading.Event()
        
        # In-memory activity log (keep last 50 entries)
        self.logs: List[str] = []

    def log(self, message: str):
        self.status_message = message
        self.logs.append(message)
        if len(self.logs) > 50:
            self.logs.pop(0)

    def reset(self, start_usn: str, end_usn: str, total_count: int):
        self.is_running = True
        self.status = "running"
        self.start_usn = start_usn
        self.end_usn = end_usn
        self.current_usn = start_usn
        self.total_count = total_count
        self.processed_count = 0
        self.captcha_base64 = None
        self.captcha_input = None
        self.captcha_event.clear()
        self.logs.clear()
        self.log(f"Initialized scraping queue: {start_usn} to {end_usn} ({total_count} USNs)")

    def request_captcha(self, base64_img: str, usn: str):
        self.status = "waiting_captcha"
        self.captcha_base64 = base64_img
        self.captcha_input = None
        self.captcha_event.clear()
        self.log(f"⚠️ Captcha required for USN: {usn}. Waiting for admin input...")

    def provide_captcha(self, text: str):
        self.captcha_input = text.strip()
        self.captcha_base64 = None
        self.status = "running"
        self.log(f"Received captcha input: {self.captcha_input}. Resuming...")
        self.captcha_event.set()

    def finish(self, reason: str = "Scraping completed successfully."):
        self.is_running = False
        self.status = "finished"
        self.captcha_base64 = None
        self.captcha_event.set()
        self.log(reason)

    def stop(self):
        self.is_running = False
        self.status = "stopped"
        self.captcha_base64 = None
        self.captcha_event.set()
        self.log("Scraper was stopped by admin.")

job_manager = JobManager()
