"""Auth routes end to end on a throwaway SQLite file.

Run from backend/:  venv\\Scripts\\python.exe -m unittest discover tests
"""
import os
import re
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
import models  # noqa: F401  (registers tables on Base)
from routes import auth as auth_routes
from services import auth_service, mail_service

UA_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
UA_FIREFOX = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0"
SMTP_ENV = {"SMTP_HOST": "smtp.test", "SMTP_FROM": "atelier@test"}


class AuthRoutesTest(unittest.TestCase):
    def setUp(self):
        fd, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        self.engine = create_engine(f"sqlite:///{self.db_path}", connect_args={"check_same_thread": False})
        event.listen(self.engine, "connect", lambda c, _: c.execute("PRAGMA foreign_keys=ON"))
        Base.metadata.create_all(self.engine)
        Local = sessionmaker(bind=self.engine)

        def db():
            s = Local()
            try:
                yield s
            finally:
                s.close()

        app = FastAPI()
        app.include_router(auth_routes.router, prefix="/api/auth")
        app.dependency_overrides[get_db] = db
        self.app = app
        self.client = self._client(UA_CHROME)
        self.sent = []
        auth_service.login_failures.clear()
        auth_service.mail_sends.clear()

    def tearDown(self):
        self.engine.dispose()
        os.remove(self.db_path)

    def _client(self, ua):
        return TestClient(self.app, headers={"user-agent": ua})

    def _capture(self, to, subject, body):
        self.sent.append((to, subject, body))

    def _token(self, kind):
        return re.search(rf"#{kind}=([\w-]+)", self.sent[-1][2]).group(1)

    def register(self, client=None, email="camille@exemple.fr", pw="motdepasse1", **extra):
        body = {"name": "Camille R.", "email": email, "password": pw, "accept": True, **extra}
        return (client or self.client).post("/api/auth/register", json=body)

    def test_register_signs_in_and_me_returns_user(self):
        r = self.register(prefs={"accent": "#5aa9f0"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("br_session", r.cookies)
        me = self.client.get("/api/auth/me").json()["user"]
        self.assertEqual(me["email"], "camille@exemple.fr")
        self.assertEqual(me["prefs"], {"accent": "#5aa9f0"})
        self.assertFalse(me["email_verified"])
        self.assertNotIn("password_hash", me)

    def test_register_validates_fields(self):
        r = self.client.post("/api/auth/register", json={"name": " ", "email": "x@", "password": "court", "accept": False})
        self.assertEqual(r.status_code, 422)
        self.assertEqual(set(r.json()["detail"]["fields"]), {"name", "email", "pw", "cgu"})

    def test_register_duplicate_email_is_case_insensitive(self):
        self.register()
        r = self.register(client=self._client(UA_FIREFOX), email="Camille@Exemple.FR")
        self.assertEqual(r.status_code, 409)

    def test_login_wrong_password_is_generic_and_throttled(self):
        self.register()
        anon = self._client(UA_FIREFOX)
        unknown = anon.post("/api/auth/login", json={"email": "nobody@exemple.fr", "password": "motdepasse1"})
        wrong = anon.post("/api/auth/login", json={"email": "camille@exemple.fr", "password": "mauvais!!"})
        self.assertEqual(unknown.status_code, 401)
        self.assertEqual(unknown.json(), wrong.json())
        for _ in range(4):
            anon.post("/api/auth/login", json={"email": "camille@exemple.fr", "password": "mauvais!!"})
        blocked = anon.post("/api/auth/login", json={"email": "camille@exemple.fr", "password": "motdepasse1"})
        self.assertEqual(blocked.status_code, 429)

    def test_logout_clears_session(self):
        self.register()
        self.client.post("/api/auth/logout")
        self.assertIsNone(self.client.get("/api/auth/me").json()["user"])
        self.assertEqual(self.client.patch("/api/auth/me", json={"name": "X"}).status_code, 401)

    def test_profile_update(self):
        self.register()
        r = self.client.patch("/api/auth/me", json={"comedien": "Camille Roux", "color": "#F06AA0"})
        self.assertEqual(r.json()["user"]["comedien"], "Camille Roux")
        self.assertEqual(self.client.patch("/api/auth/me", json={"color": "red"}).status_code, 422)

    def test_password_change_ends_other_sessions(self):
        self.register()
        other = self._client(UA_FIREFOX)
        other.post("/api/auth/login", json={"email": "camille@exemple.fr", "password": "motdepasse1"})
        sessions = self.client.get("/api/auth/me/sessions").json()
        self.assertEqual(sorted(s["device"] for s in sessions), ["Chrome · Windows", "Firefox · macOS"])
        bad = self.client.post("/api/auth/me/password", json={"current": "faux", "next": "nouveaumdp"})
        self.assertEqual(bad.status_code, 422)
        ok = self.client.post("/api/auth/me/password", json={"current": "motdepasse1", "next": "nouveaumdp"})
        self.assertEqual(ok.status_code, 200)
        self.assertIsNone(other.get("/api/auth/me").json()["user"])
        self.assertIsNotNone(self.client.get("/api/auth/me").json()["user"])

    def test_end_one_session_only_own(self):
        self.register()
        other = self._client(UA_FIREFOX)
        other.post("/api/auth/login", json={"email": "camille@exemple.fr", "password": "motdepasse1"})
        sid = next(s["id"] for s in self.client.get("/api/auth/me/sessions").json() if not s["current"])
        mine = next(s["id"] for s in self.client.get("/api/auth/me/sessions").json() if s["current"])
        self.assertEqual(self.client.delete(f"/api/auth/me/sessions/{mine}").status_code, 400)
        self.assertEqual(self.client.delete(f"/api/auth/me/sessions/{sid}").status_code, 200)
        self.assertIsNone(other.get("/api/auth/me").json()["user"])

    def test_forgot_without_smtp_is_503(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            for k in SMTP_ENV:
                os.environ.pop(k, None)
            self.assertFalse(self.client.get("/api/auth/status").json()["email"])
            self.assertEqual(self.client.post("/api/auth/forgot", json={"email": "a@b.fr"}).status_code, 503)

    def test_reset_flow(self):
        self.register()
        with mock.patch.dict(os.environ, SMTP_ENV), mock.patch.object(mail_service, "send", self._capture):
            unknown = self.client.post("/api/auth/forgot", json={"email": "nobody@exemple.fr"})
            known = self.client.post("/api/auth/forgot", json={"email": "camille@exemple.fr"})
        self.assertEqual((unknown.status_code, known.status_code), (202, 202))
        self.assertEqual(unknown.json(), known.json())
        self.assertEqual(len(self.sent), 1)
        token = self._token("reset")
        self.assertEqual(self.client.post("/api/auth/reset", json={"token": token, "password": "court"}).status_code, 422)
        r = self.client.post("/api/auth/reset", json={"token": token, "password": "toutneuf99"})
        self.assertEqual(r.status_code, 200, r.text)
        # Reset signs every browser out, and the link is single-use.
        self.assertIsNone(self.client.get("/api/auth/me").json()["user"])
        self.assertEqual(self.client.post("/api/auth/reset", json={"token": token, "password": "encoreun99"}).status_code, 400)
        login = self.client.post("/api/auth/login", json={"email": "camille@exemple.fr", "password": "toutneuf99"})
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.json()["user"]["email_verified"])

    def test_verify_flow_and_email_change(self):
        with mock.patch.dict(os.environ, SMTP_ENV), mock.patch.object(mail_service, "send", self._capture):
            self.register()
            first = self._token("verify")
            self.assertEqual(self.client.post("/api/auth/verify", json={"token": first}).status_code, 200)
            self.assertTrue(self.client.get("/api/auth/me").json()["user"]["email_verified"])
            r = self.client.post("/api/auth/me/email", json={"email": "camille@autre.fr", "password": "motdepasse1"})
            self.assertEqual(r.status_code, 200)
            self.assertFalse(r.json()["user"]["email_verified"])
            self.assertEqual(self.sent[-1][0], "camille@autre.fr")
            self.assertEqual(self.client.post("/api/auth/verify", json={"token": self._token("verify")}).status_code, 200)

    def test_export_and_delete(self):
        self.register()
        r = self.client.get("/api/auth/me/export")
        self.assertEqual(r.status_code, 200)
        self.assertIn("attachment", r.headers["content-disposition"])
        self.assertEqual(r.json()["clips"], [])
        self.assertEqual(self.client.request("DELETE", "/api/auth/me", json={"email": "autre@exemple.fr"}).status_code, 422)
        self.assertEqual(self.client.request("DELETE", "/api/auth/me", json={"email": "Camille@exemple.fr"}).status_code, 200)
        login = self.client.post("/api/auth/login", json={"email": "camille@exemple.fr", "password": "motdepasse1"})
        self.assertEqual(login.status_code, 401)


class PasswordHashTest(unittest.TestCase):
    def test_roundtrip_and_salt(self):
        a, b = auth_service.hash_password("secret123"), auth_service.hash_password("secret123")
        self.assertNotEqual(a, b)
        self.assertTrue(auth_service.verify_password("secret123", a))
        self.assertFalse(auth_service.verify_password("secret124", a))
        self.assertFalse(auth_service.verify_password("secret123", "garbage"))


if __name__ == "__main__":
    unittest.main()
