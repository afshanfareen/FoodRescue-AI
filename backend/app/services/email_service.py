"""
Email service for FoodRescue AI.
Uses smtplib (stdlib) — no extra dependencies required.
Configure SMTP_USER and SMTP_PASSWORD in backend/.env to enable real email sending.
"""
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_email(to_address: str, subject: str, html_body: str, text_body: str) -> bool:
    """
    Send an email via SMTP. Returns True on success, False on failure.
    Falls back gracefully if SMTP is not configured.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured. Email to %s not sent. Subject: %s", to_address, subject)
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
        msg["To"] = to_address

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.sendmail(settings.SMTP_USER, to_address, msg.as_string())

        logger.info("Email sent to %s: %s", to_address, subject)
        return True

    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_address, str(e))
        return False


def send_password_reset_email(to_address: str, user_name: str, reset_url: str) -> bool:
    """Send a password reset link to the user's registered email address."""
    subject = "FoodRescue AI – Reset Your Password"

    text_body = f"""Hi {user_name},

We received a request to reset your FoodRescue AI password.

Click the link below to set a new password (valid for 30 minutes):
{reset_url}

If you did not request this, you can safely ignore this email.

– FoodRescue AI Team
"""

    html_body = f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <div style="text-align: center; margin-bottom: 28px;">
    <div style="display: inline-block; background: #16a34a; border-radius: 16px; padding: 12px 20px;">
      <span style="color: white; font-size: 20px; font-weight: bold;">🌿 FoodRescue AI</span>
    </div>
  </div>
  <h2 style="color: #111827; margin-bottom: 8px;">Reset Your Password</h2>
  <p style="color: #6b7280;">Hi {user_name},</p>
  <p style="color: #6b7280;">We received a request to reset your password. Click the button below to set a new one.</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="{reset_url}"
       style="background: #16a34a; color: white; text-decoration: none; padding: 14px 32px;
              border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
      Reset Password
    </a>
  </div>
  <p style="color: #9ca3af; font-size: 13px;">This link expires in <strong>30 minutes</strong>.</p>
  <p style="color: #9ca3af; font-size: 13px;">If you did not request a password reset, you can safely ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;" />
  <p style="color: #9ca3af; font-size: 12px; text-align: center;">FoodRescue AI – AI-Assisted Hyperlocal Surplus Food Redistribution</p>
</body>
</html>
"""
    return _send_email(to_address, subject, html_body, text_body)