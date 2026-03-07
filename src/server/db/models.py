from sqlalchemy import Column, Integer, String, Float, Date, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class Liability(Base):
    __tablename__ = "liabilities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True) # e.g., "USF Tuition"
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD") # Defaulting to USD as discussed
    due_date = Column(Date, nullable=False)
    is_predicted = Column(Boolean, default=False) # Distinguish between real OCR and AI inference
    is_paid = Column(Boolean, default=False)
    category = Column(String, nullable=True)      # Tuition, Rent, etc.
    priority_level = Column(Integer, default=2)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    decision_hash = Column(String, unique=True) # The hash for the Stellar Ledger
    reasoning = Column(String)                  # The "Proof of Reason" text
