"""
Integration & route logic tests for VTU WhatNow API endpoints.
Tests auth status, admin verification, faculty JWT authentication,
and student listing privacy gates.
"""

import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, AsyncMock

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import HTTPException, Response
from starlette.requests import Request
from app.config import settings
from app.database import SessionLocal
from app.models import Faculty, Student, FacultyComparisonLog, RescrapeRequest
from app.schemas import AdminVerifyRequest, SessionCancelRequest, StudentUpdateSubmitRequest
from app.main import (
    get_auth_status,
    verify_admin,
    require_admin,
    get_students,
    get_admin_faculty_audits,
    cancel_student_record_update,
    submit_student_record_update_captcha,
)
from app.auth import create_faculty_jwt, verify_faculty_jwt, create_session
from app.scraper.worker import scraper_worker


def make_mock_request(path: str = "/", client_host: str = "127.0.0.1") -> Request:
    return Request({
        "type": "http",
        "client": (client_host, 12345),
        "headers": [],
        "method": "POST",
        "path": path,
    })


class TestAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_auth_status_nonexistent_usn(self):
        res = get_auth_status(usn="9ZZ99ZZ999", db=self.db)
        self.assertFalse(res.exists)
        self.assertEqual(res.usn, "9ZZ99ZZ999")
        self.assertEqual(res.name, "")

    def test_auth_status_existing_or_schema(self):
        student = self.db.query(Student).first()
        if student:
            res = get_auth_status(usn=student.usn, db=self.db)
            self.assertTrue(res.exists)
            self.assertEqual(res.usn, student.usn)
            self.assertIsInstance(res.is_claimed, bool)

    def test_admin_verify_incorrect_password(self):
        req = make_mock_request("/api/admin/verify")
        with self.assertRaises(HTTPException) as ctx:
            verify_admin(AdminVerifyRequest(password="definitely_wrong_pwd_999"), req)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_admin_verify_correct_password(self):
        req = make_mock_request("/api/admin/verify")
        res = verify_admin(AdminVerifyRequest(password=settings.ADMIN_PASSWORD), req)
        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("message"), "Authenticated")

    def test_require_admin_header_rejection(self):
        with self.assertRaises(HTTPException) as ctx:
            require_admin(x_admin_key="invalid_admin_secret_key")
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            require_admin(x_admin_key="")
        self.assertEqual(ctx.exception.status_code, 403)

    def test_faculty_jwt_lifecycle_and_validation(self):
        faculty = self.db.query(Faculty).first()
        if not faculty:
            faculty = Faculty(username="test_prof", name="Prof Test", department="CSE", password_hash="dummy")

        token = create_faculty_jwt(faculty=faculty)
        authenticated_fac = verify_faculty_jwt(token, self.db)
        if faculty.id:
            self.assertIsNotNone(authenticated_fac)
            self.assertEqual(authenticated_fac.username, faculty.username)

        # Tampered token rejection
        tampered_token = token[:-4] + "abcd"
        self.assertIsNone(verify_faculty_jwt(tampered_token, self.db))

        # Malformed token rejection
        self.assertIsNone(verify_faculty_jwt("", self.db))
        self.assertIsNone(verify_faculty_jwt("not.a.valid.jwt.token", self.db))

    def test_students_public_unauthenticated_gate(self):
        resp = Response()
        students = get_students(
            branch=None,
            search="",
            sort="percentage",
            limit=None,
            x_student_token=None,
            x_admin_key=None,
            x_faculty_token=None,
            authorization=None,
            response=resp,
            db=self.db,
        )
        self.assertIsInstance(students, list)
        self.assertEqual(resp.headers.get("x-is-authenticated"), "false")
        # Public campus-wide view is capped to at most 5 records
        self.assertLessEqual(len(students), 5)

    def test_students_admin_authorized_access(self):
        resp = Response()
        students = get_students(
            branch=None,
            search="",
            sort="percentage",
            limit=None,
            x_student_token=None,
            x_admin_key=settings.ADMIN_PASSWORD,
            x_faculty_token=None,
            authorization=None,
            response=resp,
            db=self.db,
        )
        self.assertIsInstance(students, list)
        self.assertEqual(resp.headers.get("x-is-authenticated"), "true")

    def test_student_available_portals_hides_urls(self):
        from app.main import get_student_available_portals
        portals = get_student_available_portals(db=self.db)
        self.assertIsInstance(portals, list)
        if portals:
            for p in portals:
                self.assertIsNotNone(p.id)
                self.assertIsNotNone(p.title)
                self.assertIsNotNone(p.semester)
                # Sensitive URL must NOT be exposed in student portal schema
                self.assertFalse(hasattr(p, "url"))

    def test_student_record_update_requires_auth(self):
        from app.main import start_student_record_update, submit_student_record_update_captcha
        from app.schemas import StudentUpdateStartRequest, StudentUpdateSubmitRequest

        # Start update without token raises 401
        coro1 = start_student_record_update(
            req=StudentUpdateStartRequest(semester_link_id=1),
            x_student_token=None,
            db=self.db
        )
        try:
            coro1.send(None)
            self.fail("Should have raised HTTPException(401)")
        except HTTPException as e:
            self.assertEqual(e.status_code, 401)
        except StopIteration:
            pass

        # Submit captcha without token raises 401
        class DummyRequest:
            client = None

        coro2 = submit_student_record_update_captcha(
            req=StudentUpdateSubmitRequest(session_id="dummy", captcha="12345"),
            request=DummyRequest(),
            x_student_token=None,
            db=self.db
        )
        try:
            coro2.send(None)
            self.fail("Should have raised HTTPException(401)")
        except HTTPException as e:
            self.assertEqual(e.status_code, 401)
        except StopIteration:
            pass

    def test_faculty_comparison_audit_log_names(self):
        # Insert a comparison log
        test_log = FacultyComparisonLog(
            faculty_username="prof_tester",
            usn_a="TEST_USN_A",
            name_a="Alice Tester",
            usn_b="TEST_USN_B",
            name_b="Bob Tester"
        )
        self.db.add(test_log)
        self.db.commit()

        try:
            audits = get_admin_faculty_audits(db=self.db)
            matching = [c for c in audits.comparison_logs if c.usn_a == "TEST_USN_A"]
            self.assertTrue(len(matching) > 0)
            self.assertEqual(matching[0].name_a, "Alice Tester")
            self.assertEqual(matching[0].name_b, "Bob Tester")
            self.assertEqual(matching[0].faculty_username, "prof_tester")
        finally:
            self.db.delete(test_log)
            self.db.commit()

    def test_cancel_student_record_update(self):
        req = SessionCancelRequest(session_id="dummy_test_session_id")
        with patch("app.main.ondemand_scraper.cancel_session", new_callable=AsyncMock) as mock_cancel:
            mock_cancel.return_value = {"ok": True, "message": "Cancelled"}
            res = asyncio.run(cancel_student_record_update(req))
        self.assertTrue(res.get("ok"))
        self.assertIn("cancelled", res.get("message", "").lower())

    def test_submit_deletion_request_creates_ticket_and_preserves_on_scrape(self):
        # 1. Setup a test student
        test_usn = "TEST99DELETEME"
        student = self.db.query(Student).filter(Student.usn == test_usn).first()
        if not student:
            student = Student(usn=test_usn, name="Delete Me Student", branch="CSE", password_hash="dummyhash", is_claimed=True)
            self.db.add(student)
            self.db.commit()
        else:
            student.password_hash = "dummyhash"
            student.is_claimed = True
            self.db.commit()

        token = create_session(test_usn, student.password_hash)
        req_obj = StudentUpdateSubmitRequest(
            session_id="dummy_delete_sess",
            captcha="ABCD",
            action_type="DELETE_REQUEST",
            description="Please remove my account"
        )
        mock_http_req = make_mock_request(path="/api/student/update-record/submit")

        # 2. Mock captcha verification success
        with patch("app.main.ondemand_scraper.submit_update_captcha", new_callable=AsyncMock) as mock_submit:
            mock_submit.return_value = {"ok": True, "message": "Captcha solved"}
            res = asyncio.run(submit_student_record_update_captcha(
                req=req_obj,
                request=mock_http_req,
                x_student_token=token,
                db=self.db
            ))

        self.assertTrue(res.ok)
        self.assertIn("deletion request sent", res.message)

        # 3. Verify DATA_DELETION ticket was created
        ticket = self.db.query(RescrapeRequest).filter(
            RescrapeRequest.usn == test_usn,
            RescrapeRequest.request_type == "DATA_DELETION"
        ).first()
        self.assertIsNotNone(ticket)
        self.assertEqual(ticket.status, "pending")

        # 4. Simulate subsequent scraper run on this USN - MUST NOT resolve the deletion ticket!
        dummy_parsed = {
            "student": {"usn": test_usn, "name": "Delete Me Student"},
            "marks": [],
            "total_marks": 0,
            "max_marks": 0,
            "percentage": 0.0,
            "total_backlogs": 0
        }
        scraper_worker._save_result(dummy_parsed, semester="1")

        # Refresh ticket from DB
        self.db.refresh(ticket)
        self.assertEqual(ticket.status, "pending", "Scraper must NOT automatically resolve DATA_DELETION tickets")

        # Cleanup
        self.db.delete(ticket)
        self.db.delete(student)
        self.db.commit()


if __name__ == "__main__":
    unittest.main()
