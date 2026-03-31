import hashlib
import json
from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
from sqlalchemy import select
from agents.state import AuraState
from my_fastapi_app.app.settings import settings
from my_fastapi_app.app.db.session import AsyncSessionLocal
from db.models import AuditLog
from tools.embeddings import generate_reasoning_embedding

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
    reasoning_text = state.get("selected_route") or "No action recommended."
    market_analysis = state.get("market_analysis", {})

    # Include the full market analysis in the audit payload
    decision_payload = {
        "market_prediction": market_analysis.get("prediction", state.get("market_prediction")),
        "market_confidence": market_analysis.get("confidence", 0.0),
        "market_thesis": market_analysis.get("thesis", ""),
        "risk_flags": market_analysis.get("risk_flags", []),
        "market_metrics": market_analysis.get("metrics", {}),
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
                    "risk_flags": decision_payload["risk_flags"]
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

        return {"audit_hash": audit_hash, "payment_decisions": updated_decisions}
