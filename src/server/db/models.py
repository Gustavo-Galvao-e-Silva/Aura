from sqlalchemy import Column, ForeignKey, Integer, String, Float, Date, Boolean, DateTime
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
