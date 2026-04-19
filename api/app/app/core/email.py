import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailMessage_:
    to: str
    subject: str
    text: str
    html: str | None = None


class EmailBackend(Protocol):
    def send(self, message: EmailMessage_) -> None: ...


class ConsoleEmailBackend:
    def send(self, message: EmailMessage_) -> None:
        logger.info(
            "email to=%s subject=%r\n%s",
            message.to,
            message.subject,
            message.text,
        )


class SMTPEmailBackend:
    def send(self, message: EmailMessage_) -> None:
        msg = EmailMessage()
        msg["From"] = (
            f"{settings.email_from_name} <{settings.email_from_address}>"
        )
        msg["To"] = message.to
        msg["Subject"] = message.subject
        msg.set_content(message.text)
        if message.html:
            msg.add_alternative(message.html, subtype="html")

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)


def _get_backend() -> EmailBackend:
    if settings.email_backend == "smtp":
        return SMTPEmailBackend()
    return ConsoleEmailBackend()


def send_email(to: str, subject: str, text: str, html: str | None = None) -> None:
    try:
        _get_backend().send(EmailMessage_(to=to, subject=subject, text=text, html=html))
    except Exception as exc:
        logger.error("Email send failed (to=%s subject=%r): %s", to, subject, exc)
