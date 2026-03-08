import hashlib
import json
import os
from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
from agents.state import AuraState

def trust_engine_node(state: AuraState):
    """
    Role 3: The Trust Engine.
    Creates a 'Proof of Reason' by hashing decisions and posting to the Stellar Ledger.
    """
    # 1. Create the Audit Payload (The "Proof of Reason")
    decision_payload = {
        "market_prediction": state.get("market_prediction"),
        "current_fx_rate": state.get("current_fx_rate"),
        "reasoning_sent": state.get("selected_route"),
        "structured_decisions": state.get("payment_decisions")
    }
    
    # Generate the SHA-256 hash
    dumped_data = json.dumps(decision_payload, sort_keys=True)
    audit_hash = hashlib.sha256(dumped_data.encode()).hexdigest()
    
    print(f"🔐 Local Audit Hash generated: {audit_hash}")

    # 2. Submit to Stellar Testnet
    secret_key = os.getenv("STELLAR_SECRET_KEY")
    
    if not secret_key:
        print("⚠️ STELLAR_SECRET_KEY missing in .env. Skipping blockchain submission.")
        return {"audit_hash": audit_hash}

    try:
        # Connect to Testnet
        server = Server("https://horizon-testnet.stellar.org")
        source_keypair = Keypair.from_secret(secret_key)
        source_account = server.load_account(source_keypair.public_key)

        # Build transaction
        # FIX: Asset.native() is used for XLM instead of asset_code="XLM"
        transaction = (
            TransactionBuilder(
                source_account=source_account,
                network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
                base_fee=100,
            )
            .add_hash_memo(bytes.fromhex(audit_hash)) # Store the full 32-byte hash
            .append_payment_op(
                destination=source_keypair.public_key, 
                amount="0.00001", 
                asset=Asset.native() 
            )
            .set_timeout(30)
            .build()
        )

        transaction.sign(source_keypair)
        response = server.submit_transaction(transaction)
        
        ledger_url = f"https://stellar.expert/explorer/testnet/tx/{response['hash']}"
        print(f"🚀 Proof of Reason stored on Ledger: {ledger_url}")
        
    except Exception as e:
        # Improved error logging to catch specific SDK issues
        print(f"⚠️ Stellar Submission Failed: {e}")

    return {"audit_hash": audit_hash}
