from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import stripe

from db.models import Users
from my_fastapi_app.app.db.session import get_db
from my_fastapi_app.app.settings import settings

router = APIRouter(prefix="/payments", tags=["Payments"])

stripe.api_key = settings.STRIPE_SECRET_KEY


class CheckoutSessionRequest(BaseModel):
    username: str
    amount_usd: float  # Amount in USD (e.g., 50.00)
    success_url: str = "http://localhost:5173/wallet?deposit=success"
    cancel_url: str = "http://localhost:5173/wallet?deposit=cancelled"


@router.get("/balance/{username}")
async def get_balance(username: str, db: AsyncSession = Depends(get_db)):
    """
    Get the current wallet balance for a user.

    Returns USD and BRL balance. Currently returns platform defaults —
    balance persistence will be added once the transactions table is created.
    """
    result = await db.execute(select(Users).where(Users.username == username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "username": username,
        "usd_balance": settings.DEFAULT_USD_BALANCE,
        "brl_balance": settings.DEFAULT_BRL_BALANCE,
    }


@router.post("/create-checkout-session")
async def create_checkout_session(
    data: CheckoutSessionRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a Stripe Checkout session for depositing funds.

    - **username**: User performing the deposit
    - **amount_usd**: Amount in USD to deposit (minimum $1.00)
    - **success_url**: Redirect URL after successful payment
    - **cancel_url**: Redirect URL if user cancels

    Returns the Stripe Checkout session URL to redirect the user to.
    """
    if data.amount_usd < 1.0:
        raise HTTPException(status_code=400, detail="Minimum deposit is $1.00")

    result = await db.execute(select(Users).where(Users.username == data.username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": "Revellio Wallet Deposit",
                            "description": f"Deposit funds to your Revellio wallet (@{data.username})",
                        },
                        "unit_amount": int(data.amount_usd * 100),  # Stripe uses cents
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=data.success_url,
            cancel_url=data.cancel_url,
            metadata={
                "username": data.username,
                "amount_usd": str(data.amount_usd),
            },
        )
    except stripe.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e.user_message}")

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/webhook")
async def stripe_webhook(request_body: bytes, db: AsyncSession = Depends(get_db)):
    """
    Stripe webhook endpoint — credits user balance after successful payment.

    Configure this URL in the Stripe Dashboard under Webhooks:
      http://your-domain/payments/webhook

    Listens for: checkout.session.completed
    """
    # In production, verify the Stripe-Signature header here using stripe.Webhook.construct_event
    # For now this is a placeholder — real credit logic goes here once DB balance columns exist.
    return {"received": True}
