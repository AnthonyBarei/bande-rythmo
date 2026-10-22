"""Local accounts — register, sign in, profile, sessions, reset by e-mail.

The app works without an account; nothing else in the API is gated. The
session is an httpOnly SameSite=Lax cookie, so other sites can neither read it
nor ride it on a cross-site POST.
"""
import asyncio
import json
import logging
import os
import re
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserSession
from services import auth_service as auth, mail_service
from services.clip_service import list_clips
from services.take_service import list_takes

log = logging.getLogger("br.auth")
router = APIRouter()

COOKIE = "br_session"
_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
_PREFS_MAX = 20_000
PREFS_VERSION = 1


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "?"


def _set_cookie(response: Response, token: str, remember: bool) -> None:
    response.set_cookie(
        COOKIE, token, httponly=True, samesite="lax", path="/",
        secure=os.environ.get("COOKIE_SECURE", "").lower() in ("1", "true"),
        # No max_age = browser-session cookie when « Rester connecté » is off.
        max_age=int(auth.SESSION_REMEMBER.total_seconds()) if remember else None,
    )


def _read_prefs(u: User) -> Optional[dict]:
    """Settings dict out of the stored blob {"v": PREFS_VERSION, "settings": {...}}.
    Blobs written before versioning are the bare settings dict (= v1)."""
    try:
        blob = json.loads(u.prefs) if u.prefs else None
    except ValueError:
        log.warning("prefs illisibles pour %s — ignorées", u.id)
        return None
    if isinstance(blob, dict) and "v" in blob and "settings" in blob:
        return blob["settings"]
    return blob


def _user_dict(u: User) -> dict:
    prefs = _read_prefs(u)
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "comedien": u.comedien or "",
        "color": u.color,
        "email_verified": bool(u.email_verified),
        "password_changed_at": u.password_changed_at.isoformat() if u.password_changed_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "prefs": prefs,
    }


class Current:
    def __init__(self, user: User, session: UserSession):
        self.user, self.session = user, session


def current(request: Request, db: Session = Depends(get_db)) -> Current:
    s = auth.session_for(db, request.cookies.get(COOKIE))
    user = db.get(User, s.user_id) if s else None
    if user is None:
        raise HTTPException(401, "Session expirée. Reconnectez-vous.")
    return Current(user, s)


async def _send(to: str, message: tuple[str, str]) -> None:
    subject, body = message
    await asyncio.to_thread(mail_service.send, to, subject, body)


def _require_mail() -> None:
    if not mail_service.available():
        raise HTTPException(503, "L'envoi d'e-mails n'est pas configuré sur cet atelier.")


# ── Public ─────────────────────────────────────────────────────────────────

@router.get("/status")
async def status():
    return {"email": mail_service.available()}


@router.get("/me")
async def me(request: Request, db: Session = Depends(get_db)):
    """Signed-in user, or {user: null} — signed out is a normal state here."""
    s = auth.session_for(db, request.cookies.get(COOKIE))
    user = db.get(User, s.user_id) if s else None
    return {"user": _user_dict(user) if user else None}


class RegisterIn(BaseModel):
    name: str
    email: str
    password: str
    accept: bool = False
    color: Optional[str] = None
    prefs: Optional[dict[str, Any]] = None


@router.post("/register")
async def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    name, email = body.name.strip(), auth.normalize_email(body.email)
    errors = {}
    if not name:
        errors["name"] = "Indiquez un nom affiché."
    elif len(name) > 80:
        errors["name"] = "80 caractères maximum."
    if not auth.email_ok(email):
        errors["email"] = "Cette adresse e-mail n’est pas valide."
    pw_err = auth.password_error(body.password)
    if pw_err:
        errors["pw"] = pw_err
    if not body.accept:
        errors["cgu"] = "Acceptez les conditions pour continuer."
    if errors:
        raise HTTPException(422, {"fields": errors})
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Un compte existe déjà avec cette adresse. Connectez-vous.")
    color = body.color if body.color and _COLOR_RE.match(body.color) else None
    user = auth.create_user(db, name, email, body.password, color)
    if body.prefs is not None:
        _store_prefs(user, body.prefs)
        db.commit()
    token = auth.create_session(db, user, remember=True, user_agent=request.headers.get("user-agent", ""))
    if mail_service.available():
        try:
            await _send(user.email, mail_service.verify_message(auth.create_link_token(db, user, "verify")))
        except Exception as e:  # account exists either way; « Renvoyer » is in Mon compte
            log.error("verify mail to %s failed: %s", user.id, e)
    response = JSONResponse({"user": _user_dict(user)})
    _set_cookie(response, token, remember=True)
    return response


class LoginIn(BaseModel):
    email: str
    password: str
    remember: bool = True


@router.post("/login")
async def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    key = f"{_client_ip(request)}|{auth.normalize_email(body.email)}"
    if auth.login_failures.blocked(key):
        raise HTTPException(429, "Trop de tentatives. Réessayez dans quelques minutes.")
    user = auth.authenticate(db, body.email, body.password[:auth.PASSWORD_MAX])
    if user is None:
        auth.login_failures.hit(key)
        raise HTTPException(401, "E-mail ou mot de passe incorrect.")
    auth.login_failures.clear(key)
    token = auth.create_session(db, user, body.remember, request.headers.get("user-agent", ""))
    response = JSONResponse({"user": _user_dict(user)})
    _set_cookie(response, token, body.remember)
    return response


@router.post("/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    auth.end_session(db, request.cookies.get(COOKIE))
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE, path="/")
    return response


class ForgotIn(BaseModel):
    email: str


@router.post("/forgot", status_code=202)
async def forgot(body: ForgotIn, db: Session = Depends(get_db)):
    """Always 202 — the answer never tells whether the address has an account."""
    _require_mail()
    email = auth.normalize_email(body.email)
    if auth.mail_sends.blocked(f"reset|{email}"):
        return {"ok": True}
    auth.mail_sends.hit(f"reset|{email}")
    user = db.query(User).filter(User.email == email).first()
    if user is not None:
        try:
            await _send(user.email, mail_service.reset_message(auth.create_link_token(db, user, "reset")))
        except Exception as e:
            log.error("reset mail to %s failed: %s", user.id, e)
    return {"ok": True}


class ResetIn(BaseModel):
    token: str
    password: str


@router.post("/reset")
async def reset(body: ResetIn, db: Session = Depends(get_db)):
    pw_err = auth.password_error(body.password)
    if pw_err:
        raise HTTPException(422, {"fields": {"pw": pw_err}})
    user = auth.consume_link_token(db, body.token, "reset")
    if user is None:
        raise HTTPException(400, "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.")
    auth.set_password(db, user, body.password)
    # The link proves the mailbox: the address is verified too.
    user.email_verified = True
    db.commit()
    auth.end_other_sessions(db, user, keep_id=None)
    return {"ok": True}


class VerifyIn(BaseModel):
    token: str


@router.post("/verify")
async def verify(body: VerifyIn, db: Session = Depends(get_db)):
    user = auth.consume_link_token(db, body.token, "verify")
    if user is None:
        raise HTTPException(400, "Ce lien a expiré ou a déjà servi.")
    user.email_verified = True
    db.commit()
    return {"ok": True}


# ── Signed in ──────────────────────────────────────────────────────────────

class ProfileIn(BaseModel):
    name: Optional[str] = None
    comedien: Optional[str] = None
    color: Optional[str] = None


@router.patch("/me")
async def update_profile(body: ProfileIn, cur: Current = Depends(current), db: Session = Depends(get_db)):
    u = cur.user
    if body.name is not None:
        name = body.name.strip()
        if not name or len(name) > 80:
            raise HTTPException(422, {"fields": {"name": "Indiquez un nom affiché (80 caractères maximum)."}})
        u.name = name
    if body.comedien is not None:
        u.comedien = body.comedien.strip()[:80] or None
    if body.color is not None:
        if not _COLOR_RE.match(body.color):
            raise HTTPException(422, {"fields": {"color": "Couleur invalide."}})
        u.color = body.color
    db.commit()
    return {"user": _user_dict(u)}


def _store_prefs(user: User, prefs: dict) -> None:
    # Versioned so a later hosted account can migrate the blob (FIXES_ACCOUNT_HOME_R2 #10).
    raw = json.dumps({"v": PREFS_VERSION, "settings": prefs})
    if len(raw) > _PREFS_MAX:
        raise HTTPException(413, "Préférences trop volumineuses.")
    user.prefs = raw


class PrefsIn(BaseModel):
    prefs: dict[str, Any]


@router.put("/me/prefs")
async def put_prefs(body: PrefsIn, cur: Current = Depends(current), db: Session = Depends(get_db)):
    _store_prefs(cur.user, body.prefs)
    db.commit()
    return {"ok": True}


class PasswordIn(BaseModel):
    current: str
    next: str


@router.post("/me/password")
async def change_password(body: PasswordIn, cur: Current = Depends(current), db: Session = Depends(get_db)):
    if not auth.verify_password(body.current[:auth.PASSWORD_MAX], cur.user.password_hash):
        raise HTTPException(422, {"fields": {"cur": "Mot de passe actuel incorrect."}})
    pw_err = auth.password_error(body.next)
    if pw_err:
        raise HTTPException(422, {"fields": {"next": pw_err}})
    auth.set_password(db, cur.user, body.next)
    db.commit()
    # A changed password signs out every other browser.
    auth.end_other_sessions(db, cur.user, keep_id=cur.session.id)
    return {"user": _user_dict(cur.user)}


class EmailIn(BaseModel):
    email: str
    password: str


@router.post("/me/email")
async def change_email(body: EmailIn, cur: Current = Depends(current), db: Session = Depends(get_db)):
    email = auth.normalize_email(body.email)
    if not auth.email_ok(email):
        raise HTTPException(422, {"fields": {"email": "Cette adresse e-mail n’est pas valide."}})
    if not auth.verify_password(body.password[:auth.PASSWORD_MAX], cur.user.password_hash):
        raise HTTPException(422, {"fields": {"pw": "Mot de passe incorrect."}})
    if email == cur.user.email:
        return {"user": _user_dict(cur.user)}
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Cette adresse est déjà utilisée par un autre compte.")
    cur.user.email = email
    cur.user.email_verified = False
    db.commit()
    if mail_service.available():
        try:
            await _send(email, mail_service.verify_message(auth.create_link_token(db, cur.user, "verify")))
        except Exception as e:
            log.error("verify mail to %s failed: %s", cur.user.id, e)
    return {"user": _user_dict(cur.user)}


@router.post("/me/verify-email", status_code=202)
async def resend_verification(cur: Current = Depends(current), db: Session = Depends(get_db)):
    _require_mail()
    if cur.user.email_verified:
        return {"ok": True}
    if auth.mail_sends.blocked(f"verify|{cur.user.id}"):
        raise HTTPException(429, "Lien déjà envoyé. Réessayez dans quelques minutes.")
    auth.mail_sends.hit(f"verify|{cur.user.id}")
    try:
        await _send(cur.user.email, mail_service.verify_message(auth.create_link_token(db, cur.user, "verify")))
    except Exception as e:
        log.error("verify mail to %s failed: %s", cur.user.id, e)
        raise HTTPException(502, "Envoi de l'e-mail impossible. Réessayez plus tard.")
    return {"ok": True}


@router.get("/me/sessions")
async def list_sessions(cur: Current = Depends(current), db: Session = Depends(get_db)):
    rows = (db.query(UserSession)
            .filter(UserSession.user_id == cur.user.id, UserSession.expires_at > datetime.now())
            .order_by(UserSession.last_seen.desc()).all())
    return [{
        "id": s.id,
        "device": auth.device_label(s.user_agent),
        "last_seen": (s.last_seen or s.created_at).isoformat(),
        "current": s.id == cur.session.id,
    } for s in rows]


@router.delete("/me/sessions/{session_id}")
async def end_one_session(session_id: int, cur: Current = Depends(current), db: Session = Depends(get_db)):
    if session_id == cur.session.id:
        raise HTTPException(400, "Utilisez « Se déconnecter » pour cet appareil.")
    n = (db.query(UserSession)
         .filter(UserSession.id == session_id, UserSession.user_id == cur.user.id).delete())
    db.commit()
    if not n:
        raise HTTPException(404, "Session introuvable.")
    return {"ok": True}


@router.delete("/me/sessions")
async def end_others(cur: Current = Depends(current), db: Session = Depends(get_db)):
    return {"ended": auth.end_other_sessions(db, cur.user, keep_id=cur.session.id)}


@router.get("/me/export")
async def export_data(cur: Current = Depends(current), db: Session = Depends(get_db)):
    """Projects, répliques and takes (metadata — the audio stays in takes/)."""
    clips = list_clips(db)
    for c in clips:
        c["takes"] = list_takes(db, c["clip_id"])
    user = _user_dict(cur.user)
    user.pop("prefs")
    payload = {"exported_at": datetime.now().isoformat(), "account": user,
               "preferences": _user_dict(cur.user)["prefs"], "clips": clips}
    stamp = datetime.now().strftime("%Y-%m-%d")
    return JSONResponse(payload, headers={
        "Content-Disposition": f'attachment; filename="bande-rythmo-{stamp}.json"'})


class DeleteIn(BaseModel):
    email: str


@router.delete("/me")
async def delete_account(body: DeleteIn, cur: Current = Depends(current), db: Session = Depends(get_db)):
    """Removes the account, its sessions and links. Local files are kept."""
    if auth.normalize_email(body.email) != cur.user.email:
        raise HTTPException(422, {"fields": {"email": "Tapez l'adresse exacte du compte."}})
    db.delete(cur.user)
    db.commit()
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE, path="/")
    return response
