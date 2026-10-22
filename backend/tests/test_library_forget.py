"""DELETE /api/{plex,jellyfin}/config forgets the saved server.

Run from backend/:  venv\\Scripts\\python.exe -m unittest discover tests
"""
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import jellyfin, plex
from services import jellyfin_service, plex_service


class ForgetConfigTest(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(plex.router, prefix="/api/plex")
        app.include_router(jellyfin.router, prefix="/api/jellyfin")
        self.client = TestClient(app)
        self.dir = tempfile.mkdtemp()

    def _check(self, name, service):
        path = os.path.join(self.dir, f"{name}.json")
        with open(path, "w") as f:
            json.dump({"url": "http://192.0.2.1:1234", "token": "secret"}, f)
        with mock.patch.object(service, "CONFIG_PATH", path):
            r = self.client.delete(f"/api/{name}/config")
            self.assertEqual(r.status_code, 200)
            self.assertFalse(r.json()["configured"])
            self.assertFalse(os.path.exists(path))
            # No token left: status answers without contacting any server.
            status = self.client.get(f"/api/{name}/status").json()
            self.assertEqual((status["configured"], status["connected"]), (False, False))
            # Forgetting twice is harmless.
            self.assertEqual(self.client.delete(f"/api/{name}/config").status_code, 200)

    def test_plex(self):
        self._check("plex", plex_service)

    def test_jellyfin(self):
        self._check("jellyfin", jellyfin_service)


if __name__ == "__main__":
    unittest.main()
