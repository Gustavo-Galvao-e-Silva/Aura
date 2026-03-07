from typing import TypedDict, List, Annotated
import operator

class AuraState(TypedDict):
    # The 'Memory' of the system
    raw_invoice_data: dict
    pending_liabilities: List[dict]
    current_fx_rate: float
    market_prediction: str  # 'BULLISH', 'BEARISH', 'NEUTRAL'
    optimal_route: dict
    user_confirmed: bool
    audit_hash: str
