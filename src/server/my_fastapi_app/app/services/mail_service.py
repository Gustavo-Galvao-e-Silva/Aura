import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_quote_alert_email(to_email: str, current_rate: float, target_rate: float, provider: str):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("FROM_EMAIL", smtp_user)

    print(from_email, smtp_password, smtp_user)

    if not smtp_host or not smtp_user or not smtp_password:
        raise ValueError("SMTP environment variables are not configured.")

    subject = "Aura FX Alert: USD/BRL quotation reached your target"

    body = f"""
Hello,

Your target USD/BRL quotation alert has been triggered.

Target rate: {target_rate:.4f}
Current best rate: {current_rate:.4f}
Best provider right now: {provider}

This means the quotation is now at or below the threshold you requested.

- Revellio
""".strip()

    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)