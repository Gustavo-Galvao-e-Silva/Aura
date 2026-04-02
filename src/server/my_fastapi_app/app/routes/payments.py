"""
Payments routes — Stripe Checkout lifecycle + wallet balance + transaction history + stablecoin settlement.

Flow:
  1. POST /payments/checkout      → create Stripe session + Checkout row (status=created)
  2. GET  /payments/balance/{u}   → read Wallet row (or return defaults if no wallet yet)
  3. GET  /payments/history/{u}   → paginated Transaction rows
  4. POST /payments/webhook       → Stripe webhook: complete Checkout, credit Wallet, write Transaction
  5. POST /payments/settle        → END-TO-END STABLECOIN FLOW: BRL → Mock-BRZ → USDC → pay bill
"""

from datetime import datetime, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from stellar_sdk import Keypair

from db.models import Checkout, Liability, Transaction, Users, Wallet
from my_fastapi_app.app.db.session import get_db
from my_fastapi_app.app.settings import settings
from my_fastapi_app.app.services.mail_service import send_payment_receipt_email
from my_fastapi_app.app.services.fx_service import get_best_fx_rate, calculate_brl_needed
from tools.stellar_tools import ensure_account_exists, establish_trustline, mint_mock_brz, swap_brz_to_usdc, MOCK_BRZ_ASSET, USDC_ASSET
from tools.circle_tools import initiate_usdc_withdrawal

router = APIRouter(prefix="/payments", tags=["Payments"])

stripe.api_key = settings.STRIPE_SECRET_KEY


# ============================================================================
# DTOs
# ============================================================================

class CreateCheckoutRequest(BaseModel):
    username: str
    amount_brl: float
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


class SettlementRequest(BaseModel):
    """Request to settle a liability using stablecoin flow (BRL → Mock-BRZ → USDC → USD)."""
    username: str
    liability_id: int


class SettlementResponse(BaseModel):
    """Response with complete settlement details and blockchain proof."""
    status: str  # "success" | "failed"
    message: str

    # Bill details
    liability_id: int
    liability_name: str
    amount_usd: float
    amount_brl_spent: float
    fx_rate: float

    # Blockchain transaction IDs (audit trail)
    stellar_mint_tx: Optional[str]
    stellar_swap_tx: Optional[str]
    database_transaction_id: int
    circle_transfer_id: Optional[str] = None  # NEW: Circle off-ramp transfer ID

    # Updated wallet balances
    new_balance_brl: float
    new_balance_usd: float


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
    if data.amount_brl < 1.0:
        raise HTTPException(status_code=400, detail="Minimum deposit is R$1.00")

    result = await db.execute(select(Users).where(Users.username == data.username))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    # Create Stripe session (BRL, charged in centavos)
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "brl",
                        "product_data": {
                            "name": "Revellio Wallet Deposit",
                            "description": f"Top-up for @{data.username}",
                        },
                        "unit_amount": int(data.amount_brl * 100),
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=data.success_url,
            cancel_url=data.cancel_url,
            metadata={"username": data.username, "amount_brl": str(data.amount_brl)},
        )
    except stripe.StripeError as exc:
        raise HTTPException(status_code=502, detail=f"Stripe error: {exc.user_message}")

    # Persist Checkout row so the webhook can be matched idempotently
    checkout = Checkout(
        username=data.username,
        currency="BRL",
        amount=data.amount_brl,
        stripe_checkout_session_id=session.id,
        metadata_json={"amount_brl": data.amount_brl},
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
    amount_brl = float((session_obj.get("metadata") or {}).get("amount_brl", 0))

    if not username or amount_brl <= 0:
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

    balance_before = wallet.brl_available

    # Credit wallet with BRL
    wallet.brl_available += amount_brl
    wallet.total_deposited_brl += amount_brl
    wallet.brl_pending = max(0.0, wallet.brl_pending - amount_brl)

    # Write immutable transaction record
    tx = Transaction(
        username=username,
        wallet_id=wallet.id,
        checkout_id=checkout.id if checkout else None,
        transaction_type="deposit",
        status="completed",
        asset="BRL",
        direction="credit",
        amount=amount_brl,
        balance_before=balance_before,
        balance_after=wallet.brl_available,
        stripe_event_id=event.get("id"),
        stripe_payment_intent_id=payment_intent_id,
        description=f"Stripe deposit R${amount_brl:.2f}",
    )
    db.add(tx)

    # Mark checkout completed
    if checkout:
        checkout.status = "completed"
        checkout.stripe_payment_intent_id = payment_intent_id
        checkout.completed_at = datetime.now(timezone.utc)

    await db.commit()

    print(f"  ✅ Credited @{username} R${amount_brl:.2f} | balance {balance_before:.2f} → {wallet.brl_available:.2f}")
    return {"received": True, "processed": True}


@router.post("/settle", response_model=SettlementResponse)
async def settle_payment(
    payment: SettlementRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    🚀 END-TO-END STABLECOIN SETTLEMENT FLOW

    This is the magic that happens when a user clicks "Pay Now" on a bill.

    Flow:
    1. Verify user has sufficient BRL balance in wallet
    2. Load the liability (bill) to be paid
    3. Calculate BRL needed based on current FX rate
    4. Create ephemeral Stellar account for user
    5. Mint Mock-BRZ to Stellar account (BRL → stablecoin on blockchain)
    6. Swap Mock-BRZ → USDC on Stellar testnet (or mock mode for MVP)
    6.5. Initiate Circle wire transfer (USDC → USD off-ramp, POC mode)
    7. Update database: debit BRL from wallet, mark liability as paid
    8. Create immutable transaction record with blockchain proof
    9. Send email receipt with full pipeline proof
    10. Return complete audit trail with all transaction IDs

    This connects Web2 (Stripe/database) with Web2.5 (blockchain proof layer).
    """
    print(f"💰 Starting stablecoin settlement for {payment.username}, liability {payment.liability_id}")

    # ========================================================================
    # Step 1: Load user and verify they exist
    # ========================================================================
    result = await db.execute(select(Users).where(Users.username == payment.username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # ========================================================================
    # Step 2: Load liability and verify it exists + belongs to user + unpaid
    # ========================================================================
    result = await db.execute(
        select(Liability).where(
            Liability.id == payment.liability_id,
            Liability.username == payment.username
        )
    )
    liability = result.scalar_one_or_none()

    if not liability:
        raise HTTPException(
            status_code=404,
            detail=f"Liability {payment.liability_id} not found for user {payment.username}"
        )

    if liability.is_paid:
        raise HTTPException(
            status_code=400,
            detail=f"Liability {payment.liability_id} is already paid"
        )

    # ========================================================================
    # Step 3: Get or create wallet, check balance
    # ========================================================================
    wallet = await _get_or_create_wallet(payment.username, db)

    # Get real-time FX rate from routes agent (Crebit/Wise/Remitly)
    print(f"   💱 Fetching real-time FX rate...")
    fx_result = await get_best_fx_rate(payment.username)
    fx_rate = fx_result["fx_rate"]
    fx_provider = fx_result["provider"]
    fx_source = fx_result["source"]

    amount_usd = liability.amount
    amount_brl_needed = calculate_brl_needed(amount_usd, fx_rate)

    print(f"   Liability: {liability.name} = ${amount_usd:.2f} USD")
    print(f"   FX Rate: {fx_rate:.4f} BRL/USD (via {fx_provider}, {fx_source})")
    print(f"   BRL needed: R${amount_brl_needed:.2f}")
    print(f"   Wallet BRL available: R${wallet.brl_available:.2f}")

    if wallet.brl_available < amount_brl_needed:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient BRL balance. Need R${amount_brl_needed:.2f}, have R${wallet.brl_available:.2f}"
        )

    # ========================================================================
    # Step 4: Create ephemeral Stellar account for this transaction
    # ========================================================================
    print(f"   🌟 Creating ephemeral Stellar account...")
    user_keypair = Keypair.random()
    user_public_key = user_keypair.public_key

    # Fund via Friendbot (testnet faucet)
    if not ensure_account_exists(user_public_key):
        raise HTTPException(
            status_code=500,
            detail="Failed to create Stellar account via Friendbot"
        )

    # Establish trustlines to Mock-BRZ and USDC
    brz_trustline = establish_trustline(user_keypair, MOCK_BRZ_ASSET)
    usdc_trustline = establish_trustline(user_keypair, USDC_ASSET)

    if not brz_trustline or not usdc_trustline:
        raise HTTPException(
            status_code=500,
            detail="Failed to establish Stellar trustlines"
        )

    print(f"   ✅ Stellar account created: {user_public_key[:10]}...")

    # ========================================================================
    # Step 5: Mint Mock-BRZ (BRL → stablecoin on blockchain)
    # ========================================================================
    print(f"   🪙 Minting R${amount_brl_needed:.2f} Mock-BRZ...")

    stellar_mint_tx = mint_mock_brz(user_public_key, amount_brl_needed)

    if not stellar_mint_tx:
        raise HTTPException(
            status_code=500,
            detail="Failed to mint Mock-BRZ on Stellar testnet"
        )

    print(f"   ✅ Mock-BRZ minted: {stellar_mint_tx[:10]}...")
    print(f"      Stellar Explorer: https://stellar.expert/explorer/testnet/tx/{stellar_mint_tx}")

    # ========================================================================
    # Step 6: Swap Mock-BRZ → USDC (stablecoin conversion)
    # ========================================================================
    print(f"   🔄 Swapping R${amount_brl_needed:.2f} Mock-BRZ → ${amount_usd:.2f} USDC...")

    swap_result = swap_brz_to_usdc(
        user_public_key=user_public_key,
        amount_brz=amount_brl_needed,
        expected_rate=fx_rate,
        use_mock=True  # MVP: use mock mode (no real USDC transferred on blockchain)
    )

    if not swap_result:
        raise HTTPException(
            status_code=500,
            detail="Failed to swap Mock-BRZ to USDC"
        )

    stellar_swap_tx = swap_result["tx_id"]
    amount_usdc_received = swap_result["amount_usdc_received"]

    print(f"   ✅ Swap complete: R${amount_brl_needed:.2f} → ${amount_usdc_received:.2f} USDC")
    print(f"      TX: {stellar_swap_tx[:10]}...")

    # ========================================================================
    # Step 6.5: Circle Off-Ramp - USDC → USD Wire Transfer (POC)
    # ========================================================================
    print(f"   💸 Initiating Circle wire transfer for ${amount_usdc_received:.2f} USDC...")

    circle_transfer_id = None
    try:
        circle_result = await initiate_usdc_withdrawal(
            amount_usd=amount_usdc_received,
            recipient_bank_account={
                "account_number": "000123456789",  # POC: hardcoded test account
                "routing_number": "021000021",      # POC: Federal Reserve Bank routing
                "bank_name": "Test University Bank",
                "account_holder_name": liability.name  # Use liability name as beneficiary
            },
            user_metadata={
                "username": payment.username,
                "liability_id": str(payment.liability_id)
            }
        )

        if circle_result:
            circle_transfer_id = circle_result.get("transfer_id", "UNKNOWN")
            print(f"   ✅ Circle transfer initiated: {circle_transfer_id}")
        else:
            print(f"   ⚠️  Circle transfer failed (non-fatal for POC)")
    except Exception as e:
        print(f"   ⚠️  Circle off-ramp error (non-fatal for POC): {e}")
        # For POC: continue even if Circle fails - just log it

    # ========================================================================
    # Step 7: Update database - debit BRL, mark liability as paid
    # ========================================================================
    print(f"   💾 Updating database...")

    brl_balance_before = wallet.brl_available

    # Debit BRL from wallet
    wallet.brl_available -= amount_brl_needed
    wallet.total_spent_brl += amount_brl_needed

    # Mark liability as paid
    liability.is_paid = True

    # Create immutable transaction record with blockchain proof
    tx = Transaction(
        username=payment.username,
        wallet_id=wallet.id,
        liability_id=liability.id,
        transaction_type="payment",
        status="completed",
        asset="BRL",
        direction="debit",
        amount=amount_brl_needed,
        balance_before=brl_balance_before,
        balance_after=wallet.brl_available,
        description=f"Paid {liability.name} (${amount_usd:.2f}) via stablecoin flow",
        metadata_json={
            "stellar_mint_tx": stellar_mint_tx,
            "stellar_swap_tx": stellar_swap_tx,
            "fx_rate": fx_rate,
            "fx_provider": fx_provider,
            "fx_source": fx_source,
            "amount_usd": amount_usd,
            "amount_brz": amount_brl_needed,
            "amount_usdc_received": amount_usdc_received,
            "stellar_account": user_public_key,
            "is_mock_swap": swap_result.get("is_mock", False)
        }
    )
    db.add(tx)

    await db.commit()
    await db.refresh(tx)  # Get the generated transaction ID

    print(f"   ✅ Database updated:")
    print(f"      BRL balance: R${brl_balance_before:.2f} → R${wallet.brl_available:.2f}")
    print(f"      Liability marked as paid: {liability.name}")
    print(f"      Transaction ID: {tx.id}")

    # ========================================================================
    # Step 8: Send email receipt with blockchain proof
    # ========================================================================
    print(f"   📧 Sending payment receipt email...")

    try:
        send_payment_receipt_email(
            to_email=user.email,
            username=payment.username,
            liability_name=liability.name,
            amount_usd=amount_usd,
            amount_brl_spent=amount_brl_needed,
            fx_rate=fx_rate,
            fx_provider=fx_provider,
            stellar_mint_tx=stellar_mint_tx,
            swap_result=swap_result,  # Changed: pass full dict instead of just tx_id
            transaction_id=tx.id,
            circle_transfer_id=circle_transfer_id  # NEW: Circle off-ramp proof
        )
    except Exception as e:
        print(f"   ⚠️  Email sending failed (non-fatal): {e}")
        # Don't fail the whole settlement if email fails

    # ========================================================================
    # Step 9: Return complete audit trail
    # ========================================================================
    return SettlementResponse(
        status="success",
        message=f"Successfully paid {liability.name} using stablecoin flow (with Circle off-ramp POC)",
        liability_id=liability.id,
        liability_name=liability.name,
        amount_usd=amount_usd,
        amount_brl_spent=amount_brl_needed,
        fx_rate=fx_rate,
        stellar_mint_tx=stellar_mint_tx,
        stellar_swap_tx=stellar_swap_tx,
        database_transaction_id=tx.id,
        new_balance_brl=wallet.brl_available,
        new_balance_usd=wallet.usd_available,
        circle_transfer_id=circle_transfer_id  # NEW: Circle off-ramp proof
    )
