import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from my_fastapi_app.app.settings import settings


def send_quote_alert_email(to_email: str, current_rate: float, target_rate: float, provider: str):
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_password = settings.SMTP_PASSWORD
    from_email = settings.from_email

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


def send_payment_receipt_email(
    to_email: str,
    username: str,
    liability_name: str,
    amount_usd: float,
    amount_brl_spent: float,
    fx_rate: float,
    stellar_mint_tx: str,
    stellar_swap_tx: str,
    transaction_id: int,
):
    """
    Send payment receipt email with blockchain proof.

    Includes:
    - Bill details (name, amount)
    - Exchange rate used
    - BRL spent
    - Stellar transaction IDs (blockchain proof)
    - Database transaction ID
    """
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_password = settings.SMTP_PASSWORD
    from_email = settings.from_email

    if not smtp_host or not smtp_user or not smtp_password:
        print("⚠️  SMTP not configured - skipping email")
        return  # Don't fail silently in MVP, just skip email

    subject = f"Payment Confirmed: {liability_name}"

    # Build blockchain explorer links
    mint_link = f"https://stellar.expert/explorer/testnet/tx/{stellar_mint_tx}"
    swap_link = f"https://stellar.expert/explorer/testnet/tx/{stellar_swap_tx}"

    body = f"""
Hello @{username},

Your payment has been successfully processed via the Revellio stablecoin flow!

PAYMENT DETAILS:
- Bill: {liability_name}
- Amount: ${amount_usd:.2f} USD
- BRL Spent: R${amount_brl_spent:.2f}
- Exchange Rate: {fx_rate:.2f} BRL/USD

BLOCKCHAIN PROOF:
✅ Step 1 - Mock-BRZ Mint:
   {mint_link}

✅ Step 2 - USDC Swap:
   {swap_link}

DATABASE TRANSACTION ID: {transaction_id}

This payment is now complete and your bill has been marked as paid.

Thank you for using Revellio!

- The Revellio Team
""".strip()

    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        print(f"   ✅ Payment receipt email sent to {to_email}")
    except Exception as e:
        print(f"   ⚠️  Failed to send email: {e}")
        # Don't fail the whole settlement if email fails