"""
Payments routes — Stripe Checkout lifecycle + wallet balance + transaction history.

Flow:
  1. POST /payments/checkout      → create Stripe session + Checkout row (status=created)
  2. GET  /payments/balance/{u}   → read Wallet row (or return defaults if no wallet yet)
  3. GET  /payments/history/{u}   → paginated Transaction rows
  4. POST /payments/webhook       → Stripe webhook: complete Checkout, credit Wallet, write Transaction
"""

from datetime import datetime, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Checkout, Transaction, Users, Wallet
from my_fastapi_app.app.db.session import get_db
from my_fastapi_app.app.settings import settings

router = APIRouter(prefix="/payments", tags=["Payments"])

stripe.api_key = settings.STRIPE_SECRET_KEY


# ============================================================================
# DTOs
# ============================================================================

class CreateCheckoutRequest(BaseModel):
    username: str
    amount_usd: float
    success_url: str = "http://localhost:5173/wallet?deposit=success"
    cancel_url: str = "http://localhost:5173/wallet?deposit=cancelled"


class BalanceResponse(BaseModel):
    username: str
    brl_available: float
    usd_available: float
    brl_pending: float
    total_deposited_brl: float
    total_spent_brl: float


class TransactionItem(BaseModel):
    id: int
    created_at: str
    transaction_type: str
    status: str
    asset: str
    direction: str
    amount: float
    balance_before: Optional[float]
    balance_after: Optional[float]
    description: str
    stripe_payment_intent_id: Optional[str]


# ============================================================================
# Helpers
# ============================================================================

async def _get_or_create_wallet(username: str, db: AsyncSession) -> Wallet:
    """Return the user's Wallet, creating one (with zero balances) if absent."""
    result = await db.execute(select(Wallet).where(Wallet.username == username))
    wallet = result.scalar_one_or_none()
    if wallet is None:
        wallet = Wallet(username=username)
        db.add(wallet)
        await db.flush()   # get .id without committing
    return wallet


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/checkout")
async def create_checkout(
    data: CreateCheckoutRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a Stripe Checkout session and persist a Checkout row.

    The frontend should redirect the user to the returned `checkout_url`.
    After payment, Stripe will POST to /payments/webhook.
    """
    if data.amount_usd < 1.0:
        raise HTTPException(status_code=400, detail="Minimum deposit is $1.00")

    result = await db.execute(select(Users).where(Users.username == data.username))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    # Create Stripe session
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": "Revellio Wallet Deposit",
                            "description": f"Top-up for @{data.username}",
                        },
                        "unit_amount": int(data.amount_usd * 100),
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=data.success_url,
            cancel_url=data.cancel_url,
            metadata={"username": data.username, "amount_usd": str(data.amount_usd)},
        )
    except stripe.StripeError as exc:
        raise HTTPException(status_code=502, detail=f"Stripe error: {exc.user_message}")

    # Persist Checkout row so the webhook can be matched idempotently
    checkout = Checkout(
        username=data.username,
        currency="USD",
        amount=data.amount_usd,
        stripe_checkout_session_id=session.id,
        metadata_json={"amount_usd": data.amount_usd},
    )
    db.add(checkout)
    await db.commit()

    return {"checkout_url": session.url, "session_id": session.id}


@router.get("/balance/{username}", response_model=BalanceResponse)
async def get_balance(username: str, db: AsyncSession = Depends(get_db)):
    """
    Return the user's Wallet balances.

    If the user has never deposited before, a zero-balance Wallet is created
    on-the-fly so the frontend always gets a valid response.
    """
    result = await db.execute(select(Users).where(Users.username == username))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    wallet = await _get_or_create_wallet(username, db)
    await db.commit()  # persist if just created

    return BalanceResponse(
        username=username,
        brl_available=wallet.brl_available,
        usd_available=wallet.usd_available,
        brl_pending=wallet.brl_pending,
        total_deposited_brl=wallet.total_deposited_brl,
        total_spent_brl=wallet.total_spent_brl,
    )


@router.get("/history/{username}", response_model=list[TransactionItem])
async def get_history(
    username: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Paginated transaction history, newest first."""
    result = await db.execute(
        select(Transaction)
        .where(Transaction.username == username)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.scalars().all()

    return [
        TransactionItem(
            id=tx.id,
            created_at=tx.created_at.isoformat(),
            transaction_type=tx.transaction_type,
            status=tx.status,
            asset=tx.asset,
            direction=tx.direction,
            amount=tx.amount,
            balance_before=tx.balance_before,
            balance_after=tx.balance_after,
            description=tx.description,
            stripe_payment_intent_id=tx.stripe_payment_intent_id,
        )
        for tx in rows
    ]


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Stripe webhook — credits the user's Wallet after a successful payment.

    Idempotent: if the Checkout row is already `completed` the event is
    acknowledged but no balance change is applied.

    Register this URL in the Stripe Dashboard:
      http://your-domain/payments/webhook
    """
    payload = await request.body()

    # Verify signature when a webhook secret is configured
    webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", None)
    if webhook_secret and stripe_signature:
        try:
            event = stripe.Webhook.construct_event(payload, stripe_signature, webhook_secret)
        except (ValueError, stripe.SignatureVerificationError) as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    else:
        # Dev fallback: parse without verification
        import json
        event = json.loads(payload)

    event_type = event.get("type", "")
    print(f"📨 Stripe webhook: {event_type}")

    if event_type != "checkout.session.completed":
        return {"received": True, "processed": False}

    session_obj = event["data"]["object"]
    session_id = session_obj.get("id")
    payment_intent_id = session_obj.get("payment_intent")
    username = (session_obj.get("metadata") or {}).get("username")
    amount_usd = float((session_obj.get("metadata") or {}).get("amount_usd", 0))

    if not username or amount_usd <= 0:
        print("  ⚠️  Missing username or amount in session metadata")
        return {"received": True, "processed": False}

    # Look up the Checkout row
    result = await db.execute(
        select(Checkout).where(Checkout.stripe_checkout_session_id == session_id)
    )
    checkout = result.scalar_one_or_none()

    if checkout and checkout.status == "completed":
        print(f"  ℹ️  Already processed checkout {session_id[:12]}… — skipping")
        return {"received": True, "processed": False, "reason": "already_completed"}

    # Look up user
    result = await db.execute(select(Users).where(Users.username == username))
    user = result.scalar_one_or_none()
    if not user:
        print(f"  ⚠️  User not found: {username}")
        return {"received": True, "processed": False, "reason": "user_not_found"}

    # Get or create wallet
    wallet = await _get_or_create_wallet(username, db)

    balance_before = wallet.usd_available

    # Credit wallet
    wallet.usd_available += amount_usd
    wallet.total_deposited_brl += amount_usd
    wallet.brl_pending = max(0.0, wallet.brl_pending - amount_usd)

    # Write immutable transaction record
    tx = Transaction(
        username=username,
        wallet_id=wallet.id,
        checkout_id=checkout.id if checkout else None,
        transaction_type="deposit",
        status="completed",
        asset="USD",
        direction="credit",
        amount=amount_usd,
        balance_before=balance_before,
        balance_after=wallet.usd_available,
        stripe_event_id=event.get("id"),
        stripe_payment_intent_id=payment_intent_id,
        description=f"Stripe deposit ${amount_usd:.2f}",
    )
    db.add(tx)

    # Mark checkout completed
    if checkout:
        checkout.status = "completed"
        checkout.stripe_payment_intent_id = payment_intent_id
        checkout.completed_at = datetime.now(timezone.utc)

    await db.commit()

    print(f"  ✅ Credited @{username} ${amount_usd:.2f} | balance {balance_before:.2f} → {wallet.usd_available:.2f}")
    return {"received": True, "processed": True}
