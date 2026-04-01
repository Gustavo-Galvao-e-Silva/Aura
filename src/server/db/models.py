from sqlalchemy import Column, ForeignKey, Integer, String, Float, Date, Boolean, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

Base = declarative_base()


class Liability(Base):
    __tablename__ = "liabilities"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, ForeignKey("users.username"), nullable=False, index=True)

    name = Column(String, index=True)  # e.g., "USF Tuition"
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD")
    due_date = Column(Date, nullable=False)
    is_predicted = Column(Boolean, default=False)
    is_paid = Column(Boolean, default=False)
    category = Column(String, nullable=True)
    priority_level = Column(Integer, default=2)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    decision_hash = Column(String, unique=True) # The hash for the Stellar Ledger
    reasoning = Column(String)                  # The "Proof of Reason" text

    stellar_tx_id = Column(String, nullable=True)

    # Semantic search: vector embedding of the reasoning + market context
    # Dimension 384 is the output size of 'all-MiniLM-L6-v2' sentence-transformer model
    reasoning_embedding = Column(Vector(384), nullable=True)

class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fullname = Column(String, nullable=False)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)

class CotationNotify(Base):
    __tablename__ = "cotation_notify"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, nullable=False, index=True)
    rate = Column(Float)
    email = Column(String, nullable=False, index=True)
    has_notified = Column(Boolean, default=False)


# ============================================================================
# Financial / Stablecoin tables
# ============================================================================

class Wallet(Base):
    """
    Current financial state for a user — one wallet per user.

    Tracks available and pending BRL/USD balances plus running totals.
    Every balance mutation must be accompanied by a Transaction row.
    """
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, ForeignKey("users.username"), unique=True, nullable=False, index=True)

    # Spendable balances
    brl_available = Column(Float, nullable=False, default=0.0)
    usd_available = Column(Float, nullable=False, default=0.0)

    # Stripe payment initiated but webhook not yet confirmed
    brl_pending = Column(Float, nullable=False, default=0.0)

    # Running totals (for quick dashboard stats)
    total_deposited_brl = Column(Float, nullable=False, default=0.0)
    total_spent_brl = Column(Float, nullable=False, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Checkout(Base):
    """
    Tracks a Stripe Checkout session from creation through completion.

    Enables idempotent webhook handling: if a webhook arrives twice we
    detect the completed status and skip double-crediting.

    Status lifecycle: created → completed | expired | cancelled
    """
    __tablename__ = "checkouts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, ForeignKey("users.username"), nullable=False, index=True)

    provider = Column(String, nullable=False, default="stripe")
    purpose = Column(String, nullable=False, default="wallet_topup")
    status = Column(String, nullable=False, default="created", index=True)

    currency = Column(String(3), nullable=False, default="USD")
    amount = Column(Float, nullable=False)

    stripe_checkout_session_id = Column(String, unique=True, nullable=True, index=True)
    stripe_payment_intent_id = Column(String, unique=True, nullable=True, index=True)

    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


class Transaction(Base):
    """
    Immutable double-entry ledger — every balance change is recorded here.

    direction = 'credit'  → balance increases  (deposit, refund)
    direction = 'debit'   → balance decreases  (payment, withdrawal)

    Never delete or update rows; only append.
    """
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, ForeignKey("users.username"), nullable=False, index=True)

    # Related records (all nullable — not every TX involves all three)
    wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=True)
    checkout_id = Column(Integer, ForeignKey("checkouts.id"), nullable=True)
    liability_id = Column(Integer, ForeignKey("liabilities.id"), nullable=True)

    transaction_type = Column(String, nullable=False)   # deposit | payment | refund | conversion
    status = Column(String, nullable=False, default="completed")  # completed | pending | failed

    asset = Column(String, nullable=False)              # BRL | USD
    direction = Column(String, nullable=False)          # credit | debit
    amount = Column(Float, nullable=False)

    # Wallet snapshot immediately before and after for easy reconciliation
    balance_before = Column(Float, nullable=True)
    balance_after = Column(Float, nullable=True)

    # External reference IDs for cross-system traceability
    stripe_event_id = Column(String, nullable=True, index=True)
    stripe_payment_intent_id = Column(String, nullable=True, index=True)

    description = Column(String, nullable=False)
    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
