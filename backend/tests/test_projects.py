"""Projects P1 — migration, /api/projects, /api/sources, clip project fields,
persisted file sources (PROJECTS_PLAN.md).

Run from backend/:  venv\\Scripts\\python.exe -m unittest discover tests
"""
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import datetime
from unittest import mock

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from database import get_db, init_db
from models import Clip, LexiconEntry, Project, Source, Subtitle, Take
from routes import clips, files, lexicon, projects, sources
from services import plex_service

PLEX_URL = "http://192.0.2.1:32400/library/parts/777/file?X-Plex-Token=SECRET"
JELLYFIN_URL = ("http://192.0.2.2:8096/Videos/abc123/stream"
                "?static=true&mediaSourceId=ms9&ApiKey=SECRET")


class Base(unittest.TestCase):
    def setUp(self):
        self.cwd = os.getcwd()
        self.dir = tempfile.mkdtemp()
        os.chdir(self.dir)
        for d in ("segments", "thumbnails", "sources", "takes", "exports"):
            os.makedirs(d)
        self.db_path = os.path.join(self.dir, "test.db")
        self.engine = create_engine(f"sqlite:///{self.db_path}", connect_args={"check_same_thread": False})
        event.listen(self.engine, "connect", lambda c, _: c.execute("PRAGMA foreign_keys=ON"))
        self.Local = sessionmaker(bind=self.engine)

    def tearDown(self):
        self.engine.dispose()
        os.chdir(self.cwd)
        shutil.rmtree(self.dir, ignore_errors=True)

    def init(self):
        init_db(self.engine)

    def client(self):
        app = FastAPI()
        app.include_router(clips.router, prefix="/api/clips")
        app.include_router(files.router, prefix="/api/files")
        app.include_router(lexicon.router, prefix="/api/lexicon")
        app.include_router(projects.router, prefix="/api/projects")
        app.include_router(sources.router, prefix="/api/sources")

        def override():
            db = self.Local()
            try:
                yield db
            finally:
                db.close()
        app.dependency_overrides[get_db] = override
        return TestClient(app)

    def add_clip(self, db, clip_id, project=None, source_path=None, source_filename="", **kw):
        seg = f"segments/{clip_id}.mp4"
        with open(seg, "wb") as f:
            f.write(b"x" * 100)
        db.add(Clip(clip_id=clip_id, name=clip_id, source_filename=source_filename,
                    source_path=source_path, start=0, end=1, segment_path=seg,
                    project=project, created_at=datetime.now(), **kw))
        db.commit()


class MigrationTest(Base):
    def seed_legacy(self):
        self.init()   # schema; nothing to migrate yet
        db = self.Local()
        db.execute(text("DELETE FROM meta"))
        db.commit()
        self.add_clip(db, "c1", project="Film A", source_path="C:/videos/a.mov", source_filename="a.mov")
        self.add_clip(db, "c2", project="Film A", source_path="C:/videos/a.mov", source_filename="a.mov")
        self.add_clip(db, "c3", project=None, source_path=PLEX_URL, source_filename="Movie.mkv")
        self.add_clip(db, "c4", project="Memes & extraits", source_filename="upload.mp4")
        self.add_clip(db, "c5", project="Film A", source_path=JELLYFIN_URL, source_filename="Ep1.mkv")
        db.add(LexiconEntry(project="Film A", term="Gandalf"))
        db.add(LexiconEntry(project="", term="global"))
        db.add(LexiconEntry(project="Orphan scope", term="x"))
        db.commit()
        db.close()

    def test_migrates_tags_sources_lexicon_and_is_idempotent(self):
        self.seed_legacy()
        self.init()
        snapshot = self.dump()
        self.init()
        self.assertEqual(snapshot, self.dump())

        db = self.Local()
        names = {p.name: p for p in db.query(Project)}
        self.assertEqual(set(names), {"Film A", "Clips importés", "Memes & extraits", "Orphan scope"})
        self.assertEqual(names["Memes & extraits"].kind, "memes")
        clips_by_id = {c.clip_id: c for c in db.query(Clip)}
        self.assertEqual(clips_by_id["c1"].project_id, names["Film A"].id)
        self.assertEqual(clips_by_id["c3"].project_id, names["Clips importés"].id)
        # Same file in the same project → one source.
        self.assertEqual(clips_by_id["c1"].source_id, clips_by_id["c2"].source_id)
        plex = db.get(Source, clips_by_id["c3"].source_id)
        self.assertEqual((plex.kind, plex.path), ("library", None))
        self.assertEqual(json.loads(plex.library), {"provider": "plex", "part_id": "777"})
        jelly = db.get(Source, clips_by_id["c5"].source_id)
        self.assertEqual(json.loads(jelly.library)["media_source_id"], "ms9")
        upload = db.get(Source, clips_by_id["c4"].source_id)
        self.assertEqual((upload.kind, upload.filename), ("local", "upload.mp4"))
        lex = {e.term: e for e in db.query(LexiconEntry)}
        self.assertEqual(lex["Gandalf"].project_id, names["Film A"].id)
        self.assertIsNone(lex["global"].project_id)
        self.assertEqual(lex["x"].project_id, names["Orphan scope"].id)
        # Legacy text untouched until P6.
        self.assertEqual(clips_by_id["c1"].project, "Film A")
        db.close()

        with self.engine.connect() as conn:
            stored = json.dumps([list(map(str, r)) for r in conn.execute(text("SELECT * FROM sources"))])
        self.assertNotIn("SECRET", stored)
        self.assertTrue(any(n.startswith("test.db.bak-projects-") for n in os.listdir(self.dir)))

    def test_adopts_clips_created_after_first_run(self):
        self.init()
        db = self.Local()
        self.add_clip(db, "late", project="Later", source_path="C:/v/b.mov")
        db.close()
        self.init()
        db = self.Local()
        clip = db.get(Clip, "late")
        self.assertEqual(db.get(Project, clip.project_id).name, "Later")
        self.assertIsNotNone(clip.source_id)
        db.close()

    def dump(self):
        with self.engine.connect() as conn:
            return {t: sorted(map(str, conn.execute(text(f"SELECT * FROM {t}")).fetchall()))
                    for t in ("projects", "sources", "clips", "lexicon")}


class ProjectsApiTest(Base):
    def setUp(self):
        super().setUp()
        self.init()
        self.c = self.client()

    def test_create_list_patch(self):
        p = self.c.post("/api/projects", json={"name": "  Série B ", "language": "fr"}).json()
        self.assertEqual((p["name"], p["language"], p["status"]), ("Série B", "fr", "active"))
        self.assertEqual(p["sources"], [])
        db = self.Local()
        db.add(Project(id="m", name="Memes & extraits", kind="memes"))
        db.commit()
        db.close()
        listed = [x["name"] for x in self.c.get("/api/projects").json()]
        self.assertEqual(listed, ["Série B"])
        self.assertIn("Memes & extraits",
                      [x["name"] for x in self.c.get("/api/projects?include_memes=true").json()])

        r = self.c.patch(f"/api/projects/{p['id']}", json={"ui_state": {"stage": "clips"}})
        self.assertEqual(r.json()["ui_state"], {"stage": "clips"})
        self.assertIsNotNone(r.json()["opened_at"])
        self.assertEqual(self.c.patch(f"/api/projects/{p['id']}", json={"status": "gone"}).status_code, 400)
        self.assertEqual(self.c.patch(f"/api/projects/{p['id']}", json={"name": " "}).status_code, 400)
        self.c.patch(f"/api/projects/{p['id']}", json={"status": "archived"})
        self.assertEqual(self.c.get("/api/projects").json(), [])
        self.assertEqual(len(self.c.get("/api/projects?status=archived").json()), 1)

    def test_rename_keeps_legacy_tags_in_step(self):
        db = self.Local()
        self.add_clip(db, "k1")
        db.close()
        self.c.put("/api/clips/k1/project", json={"project": "Old"})
        pid = self.c.get("/api/clips/k1").json()["project_id"]
        self.c.post("/api/lexicon", json={"project": "Old", "term": "t"})
        self.c.patch(f"/api/projects/{pid}", json={"name": "New"})
        self.assertEqual(self.c.get("/api/clips/k1").json()["project"], "New")
        self.assertEqual(self.c.get("/api/lexicon?project=New").json()[0]["term"], "t")

    def test_delete_needs_typed_name_and_spares_source_video(self):
        p = self.c.post("/api/projects", json={"name": "Doomed"}).json()
        original = os.path.join(self.dir, "original.mov")
        with open(original, "wb") as f:
            f.write(b"video")
        db = self.Local()
        db.add(Source(id="s1", project_id=p["id"], kind="local", path=original, filename="original.mov"))
        db.commit()
        self.add_clip(db, "d1", project_id=p["id"], source_id="s1")
        take = "takes/t.wav"
        with open(take, "wb") as f:
            f.write(b"t" * 50)
        db.add(Take(clip_id="d1", audio_path=take))
        db.add(Subtitle(clip_id="d1", start=0, end=1, text="hi"))
        db.commit()
        db.close()
        with open("sources/s1_a0.m4a", "wb") as f:
            f.write(b"a" * 25)

        detail = self.c.get(f"/api/projects/{p['id']}").json()
        self.assertEqual(detail["disk_bytes"], 175)
        self.assertEqual(detail["counts"]["lines"], 1)
        self.assertEqual(detail["sources"][0]["clip_count"], 1)
        self.assertEqual(self.c.delete(f"/api/projects/{p['id']}?confirm=nope").status_code, 400)
        r = self.c.delete(f"/api/projects/{p['id']}?confirm=Doomed")
        self.assertEqual(r.json(), {"ok": True, "freed_bytes": 175})
        self.assertEqual(self.c.get(f"/api/projects/{p['id']}").status_code, 404)
        self.assertEqual(self.c.get("/api/clips/d1").status_code, 404)
        for path in ("segments/d1.mp4", take, "sources/s1_a0.m4a"):
            self.assertFalse(os.path.exists(path), path)
        self.assertTrue(os.path.exists(original))


class ClipFieldsTest(Base):
    def setUp(self):
        super().setUp()
        self.init()
        self.c = self.client()
        db = self.Local()
        self.add_clip(db, "a")
        self.add_clip(db, "b")
        db.close()
        self.init()   # adopt into the default project

    def test_project_by_name_or_id_and_filter(self):
        r = self.c.put("/api/clips/a/project", json={"project": "Doc"}).json()
        self.assertEqual(r["project"], "Doc")
        pid = r["project_id"]
        self.assertEqual([c["clip_id"] for c in self.c.get(f"/api/clips/?project_id={pid}").json()], ["a"])
        other = self.c.post("/api/projects", json={"name": "Other"}).json()
        r = self.c.put("/api/clips/a/project", json={"project_id": other["id"]}).json()
        self.assertEqual((r["project"], r["project_id"]), ("Other", other["id"]))
        r = self.c.put("/api/clips/a/project", json={"project": ""}).json()
        self.assertEqual(r["project"], "")
        self.assertEqual(self.c.put("/api/clips/a/project", json={"project_id": "nope"}).status_code, 404)

    def test_br_offset_and_ui_state(self):
        self.assertEqual(self.c.put("/api/clips/a/br-offset", json={"br_offset": -0.4}).json()["br_offset"], -0.4)
        r = self.c.put("/api/clips/a/ui-state", json={"ui_state": {"playhead": 3.5, "pxPerSec": 180}}).json()
        self.assertEqual(r["ui_state"], {"playhead": 3.5, "pxPerSec": 180})
        self.assertEqual(self.c.put("/api/clips/zz/br-offset", json={"br_offset": 1}).status_code, 404)


class SourcesTest(Base):
    def setUp(self):
        super().setUp()
        self.init()
        self.c = self.client()
        self.p = self.c.post("/api/projects", json={"name": "P"}).json()
        self.video = os.path.join(self.dir, "v.mov")
        with open(self.video, "wb") as f:
            f.write(b"v")
        db = self.Local()
        db.add(Source(id="s1", project_id=self.p["id"], kind="local", path=self.video,
                      filename="v.mov", duration=10.0))
        db.commit()
        self.add_clip(db, "c1", project_id=self.p["id"], source_id="s1")
        db.close()

    def test_draft_tracks_and_offline(self):
        draft = {"pending": [{"name": "Scène 1", "start": 1, "end": 2}], "mark": 4}
        self.assertEqual(self.c.put("/api/sources/s1/draft", json={"draft": draft}).json()["draft"], draft)
        r = self.c.patch("/api/sources/s1", json={"audio_stream": 2}).json()
        self.assertEqual((r["audio_stream"], r["online"], r["clip_count"]), (2, True, 1))
        self.assertEqual(self.c.get("/api/sources/s1").json()["draft"], draft)
        os.remove(self.video)
        self.assertFalse(self.c.get("/api/sources/s1").json()["online"])
        r = self.c.post("/api/clips/batch-local-job",
                        json={"source_id": "s1", "clips": [{"start": 0, "end": 1}]})
        self.assertEqual(r.status_code, 409)

    def test_delete_source_keeps_clips(self):
        self.assertTrue(self.c.delete("/api/sources/s1").json()["ok"])
        clip = self.c.get("/api/clips/c1").json()
        self.assertIsNone(clip["source_id"])
        self.assertEqual(clip["project_id"], self.p["id"])

    def test_relink_checks_duration(self):
        moved = os.path.join(self.dir, "moved.mov")
        with open(moved, "wb") as f:
            f.write(b"v")
        with mock.patch.object(sources, "open_video_dialog", return_value=moved), \
             mock.patch.object(sources, "probe_streams", return_value={"duration": 42.0}):
            r = self.c.post("/api/sources/s1/relink")
            self.assertEqual(r.status_code, 409)
            self.assertEqual(r.json()["detail"]["reason"], "duration_mismatch")
            r = self.c.post("/api/sources/s1/relink?force=true")
        self.assertEqual(r.json()["path"], moved)

    def test_library_source_offline_without_config(self):
        r = self.c.post(f"/api/projects/{self.p['id']}/sources",
                        json={"path": PLEX_URL, "filename": "Movie.mkv"}).json()
        self.assertEqual((r["kind"], r["path"]), ("library", None))
        with mock.patch.object(plex_service, "CONFIG_PATH", os.path.join(self.dir, "none.json")):
            self.assertFalse(self.c.get(f"/api/sources/{r['id']}").json()["online"])
        cfg = os.path.join(self.dir, "plex.json")
        with open(cfg, "w") as f:
            json.dump({"url": "http://192.0.2.1:32400", "token": "T"}, f)
        with mock.patch.object(plex_service, "CONFIG_PATH", cfg):
            self.assertTrue(self.c.get(f"/api/sources/{r['id']}").json()["online"])


class FilesPersistenceTest(Base):
    def setUp(self):
        super().setUp()
        self.init()
        self.c = self.client()

    def test_register_stores_reference_and_survives_restart(self):
        r = self.c.post("/api/files/register", params={
            "source_id": "abc-123", "stream_url": JELLYFIN_URL, "filename": "Ep1.mkv"})
        self.assertEqual(r.status_code, 200)
        db = self.Local()
        src = db.get(Source, "abc-123")
        self.assertEqual(src.kind, "library")
        self.assertNotIn("SECRET", (src.library or "") + (src.path or ""))
        db.close()
        # Fresh router state = backend restart: the remux on disk is still ready.
        files._remux_status.clear()
        with open("sources/abc-123_a1.m4a", "wb") as f:
            f.write(b"a")
        self.assertEqual(self.c.get("/api/files/remux-status/abc-123?audio=1").json()["status"], "ready")
        self.assertEqual(self.c.get("/api/files/stream/abc-123?audio=1").status_code, 200)
        self.assertEqual(self.c.get("/api/files/remux-status/gone?audio=0").json()["reason"], "source_lost")

    def test_register_rejects_path_like_ids(self):
        r = self.c.post("/api/files/register", params={
            "source_id": "../x", "stream_url": "http://h/v.mp4", "filename": "v"})
        self.assertEqual(r.status_code, 400)

    def test_pick_with_project(self):
        p = self.c.post("/api/projects", json={"name": "P"}).json()
        video = os.path.join(self.dir, "v.mov")
        with open(video, "wb") as f:
            f.write(b"v")
        with mock.patch.object(files, "open_video_dialog", return_value=video), \
             mock.patch.object(files, "probe_streams",
                               return_value={"video_streams": [], "audio_streams": [], "duration": 5.0}):
            r = self.c.post(f"/api/files/pick?project_id={p['id']}").json()
        db = self.Local()
        src = db.get(Source, r["source_id"])
        self.assertEqual((src.project_id, src.duration, src.path), (p["id"], 5.0, video))
        db.close()


if __name__ == "__main__":
    unittest.main()
