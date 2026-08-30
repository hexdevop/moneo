import logging
import smtplib
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger("moneo.email")
settings = get_settings()


def send_password_reset_email(to_email: str, token: str) -> None:
    reset_link = f"{settings.frontend_url}/reset-password?token={token}"

    if not settings.smtp_host:
        logger.info("SMTP не настроен. Ссылка для сброса пароля (%s): %s", to_email, reset_link)
        return

    message = MIMEText(
        f"Для сброса пароля перейдите по ссылке: {reset_link}\n\n"
        "Если вы не запрашивали сброс пароля, проигнорируйте это письмо."
    )
    message["Subject"] = "Moneo — восстановление пароля"
    message["From"] = settings.smtp_from
    message["To"] = to_email

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)
