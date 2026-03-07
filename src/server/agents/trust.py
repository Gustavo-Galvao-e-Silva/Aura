import hashlib
import json
from agents.state import AuraState

def trust_engine_node(state: AuraState):
    """
    Role 3: Creates a 'Proof of Reason' by hashing the current decision.
    """
    # Create a unique string of the current decision data
    decision_data = {
        "rate": state.get("current_fx_rate"),
        "prediction": state.get("market_prediction"),
        "route": state.get("selected_route")
    }

    decision_str = json.dumps(decision_data, sort_keys=True)

    # Generate an SHA-256 hash (Simulating a Blockchain transaction hash)
    audit_hash = hashlib.sha256(decision_str.encode()).hexdigest()

    print(f"Audit Trail Generated: {audit_hash}")
    return {"audit_hash": audit_hash}
