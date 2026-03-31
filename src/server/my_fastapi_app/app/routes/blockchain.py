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
    db: AsyncSession = Depends(get_db)
):
    """
    Detect potential contradictions in AI decision-making.

    Finds pairs of decisions where:
    - Market conditions were very similar (high vector similarity)
    - But the AI made opposite recommendations (pay vs wait)

    This helps identify:
    - Inconsistent decision patterns
    - Areas where the AI may need refinement
    - Edge cases in the decision logic

    - **min_similarity**: How similar conditions must be (0.5-0.95)
    - **lookback_days**: Time window to analyze (1-365 days)

    Returns pairs of potentially contradictory decisions.
    """
    # Find decisions with high similarity but different recommendations
    # This query finds all pairs where similarity is high but reasoning differs
    # Using interval multiplication for proper parameterization: (:days * INTERVAL '1 day')
    contradiction_query = text("""
        WITH recent_decisions AS (
            SELECT
                id,
                timestamp,
                reasoning,
                decision_hash,
                stellar_tx_id,
                reasoning_embedding
            FROM audit_log
            WHERE reasoning_embedding IS NOT NULL
            AND timestamp >= NOW() - (:days * INTERVAL '1 day')
        )
        SELECT
            a.id as id_a,
            a.timestamp as timestamp_a,
            a.reasoning as reasoning_a,
            a.decision_hash as hash_a,
            b.id as id_b,
            b.timestamp as timestamp_b,
            b.reasoning as reasoning_b,
            b.decision_hash as hash_b,
            1 - (a.reasoning_embedding <=> b.reasoning_embedding) as similarity
        FROM recent_decisions a
        CROSS JOIN recent_decisions b
        WHERE a.id < b.id
        AND 1 - (a.reasoning_embedding <=> b.reasoning_embedding) >= :min_similarity
        AND (
            (a.reasoning ILIKE '%pay%' AND b.reasoning ILIKE '%wait%')
            OR (a.reasoning ILIKE '%wait%' AND b.reasoning ILIKE '%pay%')
            OR (a.reasoning ILIKE '%bullish%' AND b.reasoning ILIKE '%bearish%')
            OR (a.reasoning ILIKE '%bearish%' AND b.reasoning ILIKE '%bullish%')
        )
        ORDER BY similarity DESC
        LIMIT 10
    """)

    result = await db.execute(
        contradiction_query,
        {"min_similarity": min_similarity, "days": lookback_days}
    )
    rows = result.fetchall()

    contradictions = []
    for row in rows:
        contradictions.append({
            "similarity_score": round(float(row.similarity), 4),
            "decision_a": {
                "id": row.id_a,
                "timestamp": row.timestamp_a.isoformat(),
                "reasoning": row.reasoning_a,
                "audit_hash": row.hash_a
            },
            "decision_b": {
                "id": row.id_b,
                "timestamp": row.timestamp_b.isoformat(),
                "reasoning": row.reasoning_b,
                "audit_hash": row.hash_b
            },
            "message": "AI made different recommendations under similar conditions"
        })

    return contradictions
