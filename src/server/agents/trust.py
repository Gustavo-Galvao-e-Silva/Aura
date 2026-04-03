import hashlib
import asyncio
import json
from datetime import datetime, timedelta, timezone
from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from agents.state import AuraState
from my_fastapi_app.app.settings import settings
from my_fastapi_app.app.db.session import AsyncSessionLocal
from db.models import AuditLog
from tools.embeddings import generate_reasoning_embedding
from google import genai
from pydantic import BaseModel


class ContradictionVerification(BaseModel):
    """LLM output for contradiction verification."""
    is_contradictory: bool
    explanation: str

async def verify_contradiction_with_llm(
    reasoning_a: str,
    reasoning_b: str,
    timestamp_a: str,
    timestamp_b: str
) -> dict:
    """
    Use LLM to determine if two decisions are actually contradictory.
    Enhanced to understand that changing opinions over time is valid.
    """
    prompt = f"""You are analyzing AI decision consistency for a financial assistant.

Decision A (made at {timestamp_a}):
{reasoning_a}

Decision B (made at {timestamp_b}):
{reasoning_b}

Task: Determine if these decisions are CONTRADICTORY.

CRITICAL RULES FOR CONTRADICTION DETECTION:
1. A contradiction ONLY exists if the AI makes opposite recommendations under the EXACT SAME market conditions (e.g., processed in the same exact batch).
2. The AI is ALLOWED to "change its mind" over time. If the decisions are spaced apart, or if Decision B clearly references new developments, updated trends, or a shift in the market compared to A, this is NOT a contradiction. It is adapting to new data.
3. A true contradiction is when the AI is confused: evaluating the same data but giving conflicting outputs (e.g., "bullish so pay" vs "bullish so wait").
4. NOT a contradiction if: both recommend the same overall strategy, differences are just nuanced details, or they describe the same decision in different words.

Answer with:
1. is_contradictory: true or false
2. explanation: 1-2 sentences explaining why they are/aren't contradictory. If they aren't because the AI adapted to new info, explicitly state that.
"""

    try:
        gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)

        response = gemini_client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=[prompt],
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ContradictionVerification
            )
        )

        if response and response.text:
            result = json.loads(response.text)
            return {
                "is_contradictory": result.get("is_contradictory", False),
                "explanation": result.get("explanation", "No explanation provided")
            }

        return {"is_contradictory": False, "explanation": "LLM verification failed"}

    except Exception as e:
        print(f"⚠️ LLM contradiction verification failed: {e}")
        return {"is_contradictory": False, "explanation": f"Verification error: {e}"}

async def check_recent_contradictions(
    db: AsyncSession,
    lookback_days: int = 30,
    min_similarity: float = 0.80,
    use_llm_verification: bool = True
) -> list:
    """
    Check for contradictions in recent AI decisions using LLM verification.
    Uses temporal filtering to only compare decisions made in the same cycle.
    """
    try:
        # Step 1: Get candidate pairs based on high similarity AND temporal proximity (within 10 mins)
        candidate_query = text("""
            WITH recent_decisions AS (
                SELECT 
                    id,
                    timestamp,
                    reasoning,
                    decision_hash,
                    reasoning_embedding
                FROM audit_log
                WHERE reasoning_embedding IS NOT NULL
                AND timestamp >= NOW() - (:days * INTERVAL '1 day')
            )
            SELECT 
                a.id as id_a,
                a.timestamp as timestamp_a,
                a.reasoning as reasoning_a,
                b.id as id_b,
                b.timestamp as timestamp_b,
                b.reasoning as reasoning_b,
                1 - (a.reasoning_embedding <=> b.reasoning_embedding) as similarity
            FROM recent_decisions a
            CROSS JOIN recent_decisions b
            WHERE a.id < b.id 
            AND 1 - (a.reasoning_embedding <=> b.reasoning_embedding) >= :min_similarity
            -- HYBRID FIX: Only compare decisions made within 10 minutes of each other (600 seconds)
            -- This ensures we are comparing decisions from the same research cycle!
            AND ABS(EXTRACT(EPOCH FROM (a.timestamp - b.timestamp))) <= 600
            ORDER BY similarity DESC
            LIMIT 20
        """)

        result = await db.execute(
            candidate_query, 
            {"min_similarity": min_similarity, "days": lookback_days}
        )
        candidates = result.fetchall()

        if not candidates:
            return []

        # Step 2: Use LLM to verify which candidates are ACTUALLY contradictory
        verified_contradictions = []

        # 🚀 FIX: Cap verification to the top 3 candidates to save API quota!
        # Since this runs every 60s, we don't need to check 20 pairs at once.
        candidates_to_verify = candidates[:3]

        for i, row in enumerate(candidates_to_verify):
            if use_llm_verification:
                # 🚀 FIX: Add a 2.5-second delay between LLM calls to prevent 429 Burst Limits
                if i > 0:
                    await asyncio.sleep(2.5)

                verification = await verify_contradiction_with_llm(
                    reasoning_a=row.reasoning_a,
                    reasoning_b=row.reasoning_b,
                    timestamp_a=row.timestamp_a.isoformat(),
                    timestamp_b=row.timestamp_b.isoformat()
                )

                if verification["is_contradictory"]:
                    verified_contradictions.append({
                        "id_a": row.id_a,
                        "id_b": row.id_b,
                        "similarity": float(row.similarity),
                        "reasoning_a": row.reasoning_a,
                        "reasoning_b": row.reasoning_b,
                        "timestamp_a": row.timestamp_a.isoformat(),
                        "timestamp_b": row.timestamp_b.isoformat(),
                        "explanation": verification["explanation"]
                    })
                    print(f"   ✓ Verified contradiction: IDs {row.id_a} vs {row.id_b} ({row.similarity:.0%} similar)")
                    print(f"     Reason: {verification['explanation']}")
            else:
                # Fallback: just return all candidates without verification
                verified_contradictions.append({
                    "id_a": row.id_a,
                    "id_b": row.id_b,
                    "similarity": float(row.similarity),
                    "reasoning_a": row.reasoning_a,
                    "reasoning_b": row.reasoning_b,
                    "timestamp_a": row.timestamp_a.isoformat(),
                    "timestamp_b": row.timestamp_b.isoformat(),
                })

        return verified_contradictions

    except Exception as e:
        print(f"⚠️ Contradiction check failed: {e}")
        return []

async def trust_engine_node(state: AuraState):
    """
    Role 5: The Trust Engine.
    Dual-mode verification: Blockchain immutability + Semantic search.

    1. Blockchain Layer (Stellar):
       - Generates cryptographic hash of decision + market context
       - Stores hash on Stellar testnet for immutable proof
       - Returns transaction ID for public verification

    2. Semantic Layer (pgvector):
       - Generates 384-dim embedding of reasoning + market conditions
       - Enables similarity search to detect contradictory decisions
       - Helps identify when AI changes its mind under similar conditions

    This dual approach provides both cryptographic proof (blockchain)
    and analytical insights (semantic search) for AI explainability.
    """
    # Generate human-readable reasoning summary from payment decisions
    payment_decisions = state.get("payment_decisions", [])
    market_analysis = state.get("market_analysis", {})

    if not payment_decisions:
        reasoning_text = "No bills to evaluate."
    else:
        # Count pay vs wait decisions
        pay_now = [d for d in payment_decisions if d.get("recommended_action") == "pay"]
        wait_decisions = [d for d in payment_decisions if d.get("recommended_action") == "wait"]

        # Count executed payments
        executed = [d for d in payment_decisions if d.get("executed")]

        # Build summary
        total = len(payment_decisions)
        market_pred = market_analysis.get("prediction", "UNKNOWN")
        market_conf = int(market_analysis.get("confidence", 0) * 100)

        if executed:
            # Show executed payments
            executed_bills = ", ".join([f"{d.get('bill_name', 'Unknown')} (${d.get('amount_usd', 0):.2f})" for d in executed[:3]])
            if len(executed) > 3:
                executed_bills += f" and {len(executed) - 3} more"
            reasoning_text = f"Analyzed {total} bill(s). Market: {market_pred} ({market_conf}% confidence). Recommended: Pay {len(pay_now)}, Wait {len(wait_decisions)}. Executed {len(executed)} payment(s): {executed_bills}."
        elif pay_now:
            # Show recommended payments (not executed)
            pay_bills = ", ".join([f"{d.get('bill_name', 'Unknown')} (${d.get('amount_usd', 0):.2f})" for d in pay_now[:3]])
            if len(pay_now) > 3:
                pay_bills += f" and {len(pay_now) - 3} more"
            reasoning_text = f"Analyzed {total} bill(s). Market: {market_pred} ({market_conf}% confidence). Recommended: Pay {len(pay_now)} ({pay_bills}), Wait {len(wait_decisions)}. No auto-execution (manual approval required)."
        else:
            # All wait
            reasoning_text = f"Analyzed {total} bill(s). Market: {market_pred} ({market_conf}% confidence). Recommended: Wait on all {total} bill(s) for better rates."

    # Include the full market analysis in the audit payload
    decision_payload = {
        "market_prediction": market_analysis.get("prediction", state.get("market_prediction")),
        "market_confidence": market_analysis.get("confidence", 0.0),
        "market_thesis": market_analysis.get("thesis", ""),
        "risk_flags": market_analysis.get("risk_flags", []),
        "market_metrics": market_analysis.get("metrics", {}),
        "data_fetched_at": market_analysis.get("fetched_at", None),  # Phase 1 Step 1.4: timestamp provenance
        "current_fx_rate": state.get("current_fx_rate"),
        "reasoning": reasoning_text,
        "payment_decisions": state.get("payment_decisions")
    }
    
    # 1. Generate the Fingerprint (Audit Hash)
    dumped_data = json.dumps(decision_payload, sort_keys=True)
    audit_hash = hashlib.sha256(dumped_data.encode()).hexdigest()
    
    updated_decisions = []
    for decision in state.get("payment_decisions", []):
        d = decision.copy()
        d["audit_hash"] = audit_hash
        updated_decisions.append(d)

    async with AsyncSessionLocal() as db:
        # 2. Check if this logic state has already been hashed
        result = await db.execute(
            select(AuditLog).filter(AuditLog.decision_hash == audit_hash)
        )
        existing_log = result.scalar_one_or_none()
        if existing_log:
            print(f"♻️ Trust Engine: Audit exists. TX: {existing_log.stellar_tx_id[:10]}...")
            return {"audit_hash": audit_hash, "payment_decisions": updated_decisions}
            
        # 3. Submit to Stellar to get the REAL Transaction ID
        secret_key = settings.STELLAR_SECRET_KEY
        stellar_tx_id = None
        
        if secret_key:
            try:
                server = Server("https://horizon-testnet.stellar.org")
                source_keypair = Keypair.from_secret(secret_key)
                source_account = server.load_account(source_keypair.public_key)

                transaction = (
                    TransactionBuilder(
                        source_account=source_account,
                        network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
                        base_fee=settings.STELLAR_BASE_FEE,
                    )
                    .add_hash_memo(bytes.fromhex(audit_hash)) # Put our data hash INSIDE
                    .append_payment_op(
                        destination=source_keypair.public_key, 
                        amount="0.00001", 
                        asset=Asset.native()
                    )
                    .set_timeout(settings.STELLAR_TRANSACTION_TIMEOUT).build()
                )

                transaction.sign(source_keypair)
                response = server.submit_transaction(transaction)
                stellar_tx_id = response['hash'] # THIS IS THE REAL LINK ID
                print(f"🚀 Proof stored on Ledger. TX: {stellar_tx_id[:10]}...")
            except Exception as e:
                print(f"⚠️ Stellar Submission Failed: {e}")

        # 4. Generate semantic embedding for reasoning + context
        reasoning_embedding = None
        try:
            reasoning_embedding = generate_reasoning_embedding(
                reasoning_text=reasoning_text,
                market_context={
                    "prediction": decision_payload["market_prediction"],
                    "confidence": decision_payload["market_confidence"],
                    "thesis": decision_payload["market_thesis"],
                    "risk_flags": decision_payload["risk_flags"],
                    "data_fetched_at": decision_payload["data_fetched_at"]  # Phase 1 Step 1.4: semantic search can filter by data freshness
                }
            )
            print(f"🧬 Semantic embedding generated (384 dimensions)")
        except Exception as e:
            print(f"⚠️ Embedding generation failed: {e}")

        # 5. Save to Postgres WITH the Stellar link AND semantic embedding
        try:
            new_log = AuditLog(
                decision_hash=audit_hash,
                reasoning=reasoning_text,
                stellar_tx_id=stellar_tx_id,  # Blockchain link
                reasoning_embedding=reasoning_embedding  # Semantic search
            )
            db.add(new_log)
            await db.commit()
            print(f"🔐 Local Audit Log saved with TX reference and embedding.")
        except Exception as e:
            print(f"⚠️ Database Error: {e}")
            await db.rollback()

        # 6. Self-Correcting Monitoring: Check for contradictions with LLM verification
        contradiction_metrics = {"count": 0, "last_checked": None}
        abort_execution = False
        abort_reason = None

        try:
            print("🔍 Checking for contradictions (LLM-verified)...")
            contradictions = await check_recent_contradictions(
                db,
                lookback_days=30,
                min_similarity=0.80,  # Higher threshold for monitoring (80% vs 75% for UI)
                use_llm_verification=True  # Use LLM to verify contradictions
            )

            contradiction_count = len(contradictions)
            contradiction_metrics = {
                "count": contradiction_count,
                "last_checked": datetime.now(timezone.utc).isoformat(),
                "threshold": 0.80,
                "lookback_days": 30,
                "verified_by_llm": True
            }

            if contradiction_count > 0:
                print(f"⚠️  GOVERNANCE ALERT: {contradiction_count} VERIFIED contradiction(s) detected!")

                # ABORT EXECUTION if contradictions found
                # This forces Aura to re-research on the next heartbeat
                abort_execution = True
                abort_reason = f"Detected {contradiction_count} contradictory decision(s) in recent history. Aborting execution to avoid inconsistent behavior. Will re-research on next heartbeat (60s)."

                print(f"🛑 EXECUTION ABORTED: {abort_reason}")
                print(f"   Next heartbeat will re-gather market intelligence and try again.")

                # Log details of contradictions
                for i, c in enumerate(contradictions[:3], 1):
                    print(f"   #{i}: {c['similarity']:.0%} similarity - IDs {c['id_a']} vs {c['id_b']}")
                    print(f"       {c.get('explanation', 'No explanation')}")

            else:
                print(f"✅ Consistency Check: No verified contradictions detected")

        except Exception as e:
            print(f"⚠️ Contradiction monitoring failed: {e}")
            # Don't abort on monitoring failure - allow execution to continue

        return {
            "audit_hash": audit_hash,
            "payment_decisions": updated_decisions,
            "contradiction_metrics": contradiction_metrics,
            "abort_execution": abort_execution,
            "abort_reason": abort_reason
        }
