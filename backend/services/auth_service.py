"""Local accounts — password hashing, session tokens, one-time links.

Accounts hold identity + preferences only; clips, répliques and takes stay
shared on this machine. Sessions are opaque random tokens kept in an httpOnly
cookie; the DB only stores their SHA-256.
"""
import hashlib
import hmac
import re
import secrets
import threading
import time
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from models import User, UserSession, AuthToken

PASSWORD_MIN = 8
PASSWORD_MAX = 256          # scrypt cost is per byte — cap the input
SESSION_SHORT = timedelta(hours=12)
SESSION_REMEMBER = timedelta(days=30)
TOKEN_TTL = {"reset": timedelta(minutes=30), "verify": timedelta(hours=48)}
TOUCH_EVERY = timedelta(minutes=5)

_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2 ** 14, 8, 1
_SCRYPT_MAXMEM = 64 * 1024 * 1024
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def email_ok(email: str) -> bool:
    return bool(_EMAIL_RE.match(email)) and len(email) <= 254


def password_error(pw: str) -> Optional[str]:
    if len(pw or "") < PASSWORD_MIN:
        return "8 caractères minimum."
    if len(pw) > PASSWORD_MAX:
        return "256 caractères maximum."
    return None


def hash_password(pw: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(pw.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P,
                        maxmem=_SCRYPT_MAXMEM, dklen=32)
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${salt.hex()}${dk.hex()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        algo, n, r, p, salt, dk = stored.split("$")
        if algo != "scrypt":
            return False
        expected = bytes.fromhex(dk)
        got = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p),
                             maxmem=_SCRYPT_MAXMEM, dklen=len(expected))
    except ValueError:
        return False
    return hmac.compare_digest(got, expected)


# Unknown e-mails still pay for one scrypt, so login timing doesn't tell
# whether an account exists.
_DUMMY_HASH = hash_password(secrets.token_hex(8))


def _sha(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def authenticate(db: Session, email: str, pw: str) -> Optional[User]:
    user = db.query(User).filter(User.email == normalize_email(email)).first()
    if user is None:
        verify_password(pw, _DUMMY_HASH)
        return None
    return user if verify_password(pw, user.password_hash) else None


def create_user(db: Session, name: str, email: str, pw: str, color: Optional[str]) -> User:
    user = User(id=uuid.uuid4().hex, email=normalize_email(email), password_hash=hash_password(pw),
                name=name.strip(), color=color)
    db.add(user)
    db.commit()
    return user


def set_password(db: Session, user: User, pw: str) -> None:
    user.password_hash = hash_password(pw)
    user.password_changed_at = datetime.now()


# ── Sessions ───────────────────────────────────────────────────────────────

def create_session(db: Session, user: User, remember: bool, user_agent: str) -> str:
    token = secrets.token_urlsafe(32)
    now = datetime.now()
    db.query(UserSession).filter(UserSession.expires_at <= now).delete()
    db.add(UserSession(token_hash=_sha(token), user_id=user.id, remember=remember,
                       user_agent=(user_agent or "")[:400], created_at=now, last_seen=now,
                       expires_at=now + (SESSION_REMEMBER if remember else SESSION_SHORT)))
    db.commit()
    return token


def session_for(db: Session, token: Optional[str]) -> Optional[UserSession]:
    """Live session for a cookie token. Slides the expiry (throttled)."""
    if not token:
        return None
    s = db.query(UserSession).filter(UserSession.token_hash == _sha(token)).first()
    if s is None:
        return None
    now = datetime.now()
    if s.expires_at <= now:
        db.delete(s)
        db.commit()
        return None
    if now - (s.last_seen or s.created_at) >= TOUCH_EVERY:
        s.last_seen = now
        s.expires_at = now + (SESSION_REMEMBER if s.remember else SESSION_SHORT)
        db.commit()
    return s


def end_session(db: Session, token: Optional[str]) -> None:
    if token:
        db.query(UserSession).filter(UserSession.token_hash == _sha(token)).delete()
        db.commit()


def end_other_sessions(db: Session, user: User, keep_id: Optional[int]) -> int:
    q = db.query(UserSession).filter(UserSession.user_id == user.id)
    if keep_id is not None:
        q = q.filter(UserSession.id != keep_id)
    n = q.delete()
    db.commit()
    return n


def device_label(user_agent: str) -> str:
    """« Chrome · Windows » from a User-Agent — enough to tell sessions apart."""
    ua = user_agent or ""
    if "Edg/" in ua:
        browser = "Edge"
    elif "OPR/" in ua or "Opera" in ua:
        browser = "Opera"
    elif "Firefox/" in ua:
        browser = "Firefox"
    elif "Chrome/" in ua:
        browser = "Chrome"
    elif "Safari/" in ua:
        browser = "Safari"
    else:
        browser = "Navigateur"
    if "iPad" in ua:
        os_name = "iPad"
    elif "iPhone" in ua:
        os_name = "iPhone"
    elif "Android" in ua:
        os_name = "Android"
    elif "Windows" in ua:
        os_name = "Windows"
    elif "Mac OS X" in ua or "Macintosh" in ua:
        os_name = "macOS"
    elif "Linux" in ua:
        os_name = "Linux"
    else:
        os_name = "système inconnu"
    return f"{browser} · {os_name}"


# ── One-time links ─────────────────────────────────────────────────────────

def create_link_token(db: Session, user: User, kind: str) -> str:
    """New reset/verify token; older ones of the same kind stop working."""
    db.query(AuthToken).filter(AuthToken.user_id == user.id, AuthToken.kind == kind).delete()
    token = secrets.token_urlsafe(32)
    db.add(AuthToken(token_hash=_sha(token), user_id=user.id, kind=kind, email=user.email,
                     expires_at=datetime.now() + TOKEN_TTL[kind]))
    db.commit()
    return token


def consume_link_token(db: Session, token: str, kind: str) -> Optional[User]:
    """User of a valid, unexpired token — the token is spent either way."""
    row = db.query(AuthToken).filter(AuthToken.token_hash == _sha(token or ""),
                                     AuthToken.kind == kind).first()
    if row is None:
        return None
    db.delete(row)
    db.commit()
    if row.expires_at <= datetime.now():
        return None
    user = db.get(User, row.user_id)
    # A verify link only proves the address it was sent to.
    if user is None or (kind == "verify" and row.email != user.email):
        return None
    return user


# ── Throttling ─────────────────────────────────────────────────────────────

class Throttle:
    """In-memory sliding window: at most `limit` hits per key per `window` s."""

    def __init__(self, limit: int, window: float):
        self.limit, self.window = limit, window
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str, now: float) -> list[float]:
        hits = [t for t in self._hits.get(key, []) if now - t < self.window]
        self._hits[key] = hits
        return hits

    def blocked(self, key: str) -> bool:
        with self._lock:
            return len(self._recent(key, time.monotonic())) >= self.limit

    def hit(self, key: str) -> None:
        with self._lock:
            now = time.monotonic()
            self._recent(key, now).append(now)

    def clear(self, key: Optional[str] = None) -> None:
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)


login_failures = Throttle(limit=5, window=15 * 60)
mail_sends = Throttle(limit=3, window=15 * 60)
