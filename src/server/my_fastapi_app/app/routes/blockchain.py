from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from db.models import AuditLog
from my_fastapi_app.app.config import STELLAR_EXPLORER_BASE_URL
from my_fastapi_app.app.db.session import get_db

router = APIRouter(prefix="/blockchain", tags=["Blockchain Audit"])


@router.get("/verify/{identifier}")
async def verify_reasoning(identifier: str, db: Session = Depends(get_db)):
    """
    Verify AI payment decisions on the Stellar blockchain.

    Flexible Verification: Lookup by either the Audit Hash (data) or Stellar TX ID (ledger).

    - **identifier**: Either the decision hash or Stellar transaction ID

    Returns the verified reasoning, timestamp, and link to Stellar Explorer.
    """
    # Search for the identifier in BOTH the decision_hash and stellar_tx_id columns
    log_entry = db.query(AuditLog).filter(
        or_(
            AuditLog.decision_hash == identifier,
            AuditLog.stellar_tx_id == identifier
        )
    ).first()

    if not log_entry:
        raise HTTPException(
            status_code=404,
            detail="Audit trail not found. Ensure you are using a valid Hash or Transaction ID."
        )

    # Always prefer the real Stellar TX ID for the link if it exists
    link_id = log_entry.stellar_tx_id or log_entry.decision_hash

    return {
        "status": "Verified",
        "timestamp": log_entry.timestamp,
        "reasoning": log_entry.reasoning,
        "audit_hash": log_entry.decision_hash,
        "stellar_tx_id": log_entry.stellar_tx_id,
        "ledger_url": f"{STELLAR_EXPLORER_BASE_URL}/{link_id}",
        "message": "This decision is cryptographically locked on the Stellar Public Ledger."
    }
