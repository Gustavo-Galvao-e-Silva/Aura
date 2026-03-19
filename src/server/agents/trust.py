import hashlib
import json
import os
from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
from agents.state import AuraState
from my_fastapi_app.app.db.session import SessionLocal
from db.models import AuditLog

def trust_engine_node(state: AuraState):
    """
    Role 3: The Trust Engine.
    Captures the REAL Stellar TX ID and saves it to Postgres.
    """
    reasoning_text = state.get("selected_route") or "No action recommended."
    
    decision_payload = {
        "market_prediction": state.get("market_prediction"),
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
    
    db = SessionLocal()
    try:
        # 2. Check if this logic state has already been hashed
        existing_log = db.query(AuditLog).filter(AuditLog.decision_hash == audit_hash).first()
        if existing_log:
            print(f"♻️ Trust Engine: Audit exists. TX: {existing_log.stellar_tx_id[:10]}...")
            return {"audit_hash": audit_hash, "payment_decisions": updated_decisions}
            
        # 3. Submit to Stellar to get the REAL Transaction ID
        secret_key = os.getenv("STELLAR_SECRET_KEY")
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
                        base_fee=100,
                    )
                    .add_hash_memo(bytes.fromhex(audit_hash)) # Put our data hash INSIDE
                    .append_payment_op(
                        destination=source_keypair.public_key, 
                        amount="0.00001", 
                        asset=Asset.native() 
                    )
                    .set_timeout(30).build()
                )

                transaction.sign(source_keypair)
                response = server.submit_transaction(transaction)
                stellar_tx_id = response['hash'] # THIS IS THE REAL LINK ID
                print(f"🚀 Proof stored on Ledger. TX: {stellar_tx_id[:10]}...")
            except Exception as e:
                print(f"⚠️ Stellar Submission Failed: {e}")

        # 4. Save to Postgres WITH the Stellar link
        new_log = AuditLog(
            decision_hash=audit_hash,
            reasoning=reasoning_text,
            stellar_tx_id=stellar_tx_id # Save the link!
        )
        db.add(new_log)
        db.commit()
        print(f"🔐 Local Audit Log saved with TX reference.")
        
    except Exception as e:
        print(f"⚠️ Database Error: {e}")
        db.rollback()
    finally:
        db.close()

    return {"audit_hash": audit_hash, "payment_decisions": updated_decisions}
