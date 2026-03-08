from typing import TypedDict, List, Optional

class AuraState(TypedDict):
    # Current financial snapshot
    brl_balance: float
    usd_balance: float
    current_fx_rate: float
    
    # Intelligence data
    pending_liabilities: List[dict]  # From Visionary Accountant
    market_prediction: str           # From FX Strategist ('BUY', 'WAIT')
    
    # Execution data
    route_options: List[dict]
    selected_route: Optional[dict]   # From Smart Router
    audit_hash: Optional[str]        # From Trust Engine
