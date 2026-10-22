"""Outgoing e-mail (password reset, address verification) over SMTP.

Config via env (no hardcoded credentials):
- SMTP_HOST, SMTP_FROM          required — without them e-mail is unavailable
- SMTP_PORT                     default 587
- SMTP_USER, SMTP_PASSWORD      optional login
- SMTP_SECURITY                 starttls (default) | ssl | none
- APP_URL                       base of the links, default http://localhost:5173

When unavailable, the UI hides « Mot de passe oublié » and verification, and
the routes answer 503.
"""
import os
import smtplib
import ssl
from email.message import EmailMessage


class MailUnavailable(Exception):
    pass


def available() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_FROM"))


def app_url() -> str:
    return os.environ.get("APP_URL", "http://localhost:5173").rstrip("/")


def send(to: str, subject: str, body: str) -> None:
    """Blocking send — call through asyncio.to_thread from routes."""
    if not available():
        raise MailUnavailable("SMTP_HOST / SMTP_FROM not set")
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    security = os.environ.get("SMTP_SECURITY", "starttls").lower()
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD", "")

    msg = EmailMessage()
    msg["From"] = os.environ["SMTP_FROM"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    ctx = ssl.create_default_context()
    if security == "ssl":
        server = smtplib.SMTP_SSL(host, port, context=ctx, timeout=20)
    else:
        server = smtplib.SMTP(host, port, timeout=20)
    with server:
        if security == "starttls":
            server.starttls(context=ctx)
        if user:
            server.login(user, password)
        server.send_message(msg)


def reset_message(token: str) -> tuple[str, str]:
    link = f"{app_url()}/app/#reset={token}"
    return ("Bande Rythmo — nouveau mot de passe",
            "Bonjour,\n\n"
            "Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) :\n\n"
            f"{link}\n\n"
            "Si vous n'avez rien demandé, ignorez ce message : votre mot de passe ne change pas.\n")


def verify_message(token: str) -> tuple[str, str]:
    link = f"{app_url()}/app/#verify={token}"
    return ("Bande Rythmo — confirmez votre adresse",
            "Bonjour,\n\n"
            "Pour confirmer votre adresse e-mail, ouvrez ce lien (valable 48 heures) :\n\n"
            f"{link}\n")
