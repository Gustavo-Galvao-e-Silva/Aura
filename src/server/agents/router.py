from agents.state import AuraState

def smart_router_node(state: AuraState):
    """Calculates the best path for the first pending bill."""
    if not state["pending_liabilities"]:
        return {"selected_route": None}
    
    bill = state["pending_liabilities"][0]
    amount = bill["amount_due"]
    rate = state["current_fx_rate"]
    
    # Simulate costs
    # Crebit: Fast, optimized for students
    crebit_cost = (amount * rate) + 8.00 
    # Bank: Fixed high fee
    bank_cost = (amount * (rate + 0.02)) + 45.00 

    routes = [
        {"name": "Crebit", "total_brl": crebit_cost, "speed": "1hr"},
        {"name": "Bank Wire", "total_brl": bank_cost, "speed": "3 days"}
    ]
    
    best = min(routes, key=lambda x: x["total_brl"])
    return {"selected_route": best}
