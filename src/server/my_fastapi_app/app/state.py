"""
Shared application state for the AI agent system.
"""
from agents.state import AuraState

# Global state for the AI agent system
current_state: AuraState = {
    "payment_decisions": [],
    "route_options": [],
    "brl_balance": 50000.0,
    "usd_balance": 0.0,
    "current_fx_rate": 0.0,
    "pending_liabilities": [],
    "market_prediction": "NEUTRAL",
    "selected_route": None,
    "audit_hash": None
}


def get_current_state() -> AuraState:
    """Get the current agent state."""
    return current_state


def update_state(new_state: dict) -> None:
    """Update the current agent state."""
    global current_state
    current_state.update(new_state)
