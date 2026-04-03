from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional

from db.models import AuditLog
from my_fastapi_app.app.config import STELLAR_EXPLORER_BASE_URL
from my_fastapi_app.app.db.session import get_db
from tools.embeddings import generate_reasoning_embedding

router = APIRouter(prefix="/blockchain", tags=["Blockchain Audit"])


class SemanticSearchResult(BaseModel):
    """Result from semantic similarity search."""
    audit_id: int
    timestamp: str
    reasoning: str
    audit_hash: str
    stellar_tx_id: Optional[str]
    similarity_score: float
    ledger_url: str


class AuditLogListItem(BaseModel):
    """Audit log row for UI list rendering."""

    audit_id: int
    timestamp: str
    reasoning: str
    audit_hash: str
    stellar_tx_id: Optional[str]
    status: str
    network: str
    ledger_url: str


@router.get("/audit-log", response_model=List[AuditLogListItem])
async def list_audit_log(
    limit: int = Query(20, ge=1, le=200, description="Maximum number of audit entries"),
    db: AsyncSession = Depends(get_db),
):
    """
    List recent audit log entries for frontend visualization.

    Returns the most recent rows first, with Stellar explorer links and
    a derived verification status.
    """
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    )
    rows = result.scalars().all()

    entries: List[AuditLogListItem] = []
    for row in rows:
        link_id = row.stellar_tx_id or row.decision_hash
        entries.append(
            AuditLogListItem(
                audit_id=row.id,
                timestamp=row.timestamp.isoformat() if row.timestamp else "",
                reasoning=row.reasoning or "",
                audit_hash=row.decision_hash,
                stellar_tx_id=row.stellar_tx_id,
                status="verified" if row.stellar_tx_id else "pending",
                network="Stellar Testnet",
                ledger_url=f"{STELLAR_EXPLORER_BASE_URL}/{link_id}",
            )
        )

    return entries


@router.get("/verify/{identifier}")
async def verify_reasoning(identifier: str, db: AsyncSession = Depends(get_db)):
    """
    Verify AI payment decisions on the Stellar blockchain.

    Flexible Verification: Lookup by either the Audit Hash (data) or Stellar TX ID (ledger).

    - **identifier**: Either the decision hash or Stellar transaction ID

    Returns the verified reasoning, timestamp, and link to Stellar Explorer.
    """
    # Search for the identifier in BOTH the decision_hash and stellar_tx_id columns
    result = await db.execute(
        select(AuditLog).filter(
            or_(
                AuditLog.decision_hash == identifier,
                AuditLog.stellar_tx_id == identifier
            )
        )
    )
    log_entry = result.scalar_one_or_none()

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


@router.get("/search/similar", response_model=List[SemanticSearchResult])
async def search_similar_reasoning(
    query: str = Query(..., description="Search query describing market conditions or reasoning"),
    limit: int = Query(5, ge=1, le=20, description="Maximum number of results"),
    threshold: float = Query(0.7, ge=0.0, le=1.0, description="Minimum similarity score (0-1)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Semantic search for similar AI reasoning in past decisions.

    Uses vector similarity (cosine distance) to find decisions made under
    similar market conditions or with similar reasoning patterns.

    Useful for:
    - Finding precedents for current market conditions
    - Detecting contradictions (similar conditions → opposite decisions)
    - Understanding AI decision consistency over time

    - **query**: Natural language description (e.g., "bearish BRL high fiscal risk")
    - **limit**: Maximum results to return (1-20)
    - **threshold**: Minimum similarity score 0.0-1.0 (higher = more similar)

    Returns decisions ranked by semantic similarity to the query.
    """
    # Generate embedding for the search query
    try:
        query_embedding = generate_reasoning_embedding(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate query embedding: {e}")

    # Perform vector similarity search using pgvector's <=> operator (cosine distance)
    # Note: pgvector uses distance (lower = more similar), we convert to similarity (higher = more similar)
    # Convert the Python list to a string representation for pgvector
    vector_str = str(query_embedding)

    similarity_query = text("""
        SELECT
            id,
            timestamp,
            reasoning,
            decision_hash,
            stellar_tx_id,
            1 - (reasoning_embedding <=> CAST(:query_embedding AS vector)) AS similarity
        FROM audit_log
        WHERE reasoning_embedding IS NOT NULL
        AND 1 - (reasoning_embedding <=> CAST(:query_embedding AS vector)) >= :threshold
        ORDER BY similarity DESC
        LIMIT :limit
    """)

    result = await db.execute(
        similarity_query,
        {
            "query_embedding": vector_str,
            "threshold": threshold,
            "limit": limit
        }
    )
    rows = result.fetchall()

    if not rows:
        return []

    # Format results
    results = []
    for row in rows:
        link_id = row.stellar_tx_id or row.decision_hash
        results.append(SemanticSearchResult(
            audit_id=row.id,
            timestamp=row.timestamp.isoformat(),
            reasoning=row.reasoning,
            audit_hash=row.decision_hash,
            stellar_tx_id=row.stellar_tx_id,
            similarity_score=round(float(row.similarity), 4),
            ledger_url=f"{STELLAR_EXPLORER_BASE_URL}/{link_id}"
        ))

    return results


@router.get("/search/contradictions", response_model=List[dict])
async def detect_contradictions(
    min_similarity: float = Query(0.75, ge=0.5, le=0.95, description="Minimum context similarity"),
    lookback_days: int = Query(30, ge=1, le=365, description="Days to look back"),
    use_llm_verification: bool = Query(True, description="Use LLM to verify contradictions"),
    db: AsyncSession = Depends(get_db)
):
    """
    Detect contradictions in AI decision-making using LLM verification.

    Finds pairs of decisions where:
    - Market conditions were very similar (high vector similarity)
    - LLM confirms they are actually contradictory (not just keyword matches)

    This helps identify:
    - Inconsistent decision patterns
    - Areas where the AI may need refinement
    - Edge cases in the decision logic

    - **min_similarity**: How similar conditions must be (0.5-0.95)
    - **lookback_days**: Time window to analyze (1-365 days)
    - **use_llm_verification**: Use LLM to verify contradictions (default: True)

    Returns verified contradictory decision pairs.
    """
    # Import the LLM verification function from trust engine
    from agents.trust import check_recent_contradictions

    # Use the trust engine's LLM-verified contradiction checker
    verified_contradictions = await check_recent_contradictions(
        db=db,
        lookback_days=lookback_days,
        min_similarity=min_similarity,
        use_llm_verification=use_llm_verification
    )

    # Format for API response
    contradictions = []
    for c in verified_contradictions:
        contradictions.append({
            "similarity_score": round(c["similarity"], 4),
            "decision_a": {
                "id": c["id_a"],
                "timestamp": c["timestamp_a"],
                "reasoning": c["reasoning_a"],
                "audit_hash": c.get("audit_hash_a", "")
            },
            "decision_b": {
                "id": c["id_b"],
                "timestamp": c["timestamp_b"],
                "reasoning": c["reasoning_b"],
                "audit_hash": c.get("audit_hash_b", "")
            },
            "message": c.get("explanation", "AI made different recommendations under similar conditions")
        })

    return contradictions
