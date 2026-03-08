import hashlib
import json
import os
from stellar_sdk import Server, Keypair, TransactionBuilder, Network
from agents.state import AuraState

def trust_engine_node(state: AuraState):
    """
    Role 3: The Trust Engine.
    Creates a 'Proof of Reason' by hashing decisions and posting to the Stellar Ledger.
    """
    # 1. Create the Audit Payload
    decision_data = {
        "rate": state.get("current_fx_rate"),
        "prediction": state.get("market_prediction"),
        "decisions": state.get("payment_decisions")
    }
    
    # Generate the local hash
    decision_str = json.dumps(decision_data, sort_keys=True)
    audit_hash = hashlib.sha256(decision_str.encode()).hexdigest()
    
    print(f"🔐 Local Audit Hash generated: {audit_hash}")

    # 2. Submit to Stellar Testnet (The "Immutable Proof")
    # Get your secret from https://laboratory.stellar.org/ (Testnet tab)
    secret_key = os.getenv("STELLAR_SECRET_KEY")
    
    if not secret_key:
        print("⚠️ STELLAR_SECRET_KEY missing in .env. skipping ledger submission.")
        return {"audit_hash": audit_hash}

    try:
        server = Server("https://horizon-testnet.stellar.org")
        source_keypair = Keypair.from_secret(secret_key)
        source_account = server.load_account(source_keypair.public_key)

        # Build a transaction that stores the hash in the 'Memo' field
        transaction = (
            TransactionBuilder(
                source_account=source_account,
                network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
                base_fee=100,
            )
            .add_text_memo(audit_hash[:28]) # Stellar memo limit is 28 chars
            .append_payment_op(
                destination=source_keypair.public_key, 
                amount="0.00001", 
                asset_code="XLM"
            )
            .set_timeout(30)
            .build()
        )

        transaction.sign(source_keypair)
        response = server.submit_transaction(transaction)
        
        tx_url = f"https://stellar.expert/explorer/testnet/tx/{response['hash']}"
        print(f"🚀 Proof of Reason stored on Ledger: {tx_url}")
        
    except Exception as e:
        print(f"⚠️ Stellar Submission Failed: {e}")

    return {"audit_hash": audit_hash}
