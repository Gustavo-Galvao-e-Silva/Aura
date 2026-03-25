from typing import TypedDict, List, Optional, Dict, Any, Annotated

class MarketAnalysis(TypedDict):
    prediction: str # "BULLISH" | "BEARISH" | "NEUTRAL"
    confidence: float # 0.0 to 1.0
    thesis: str # 2 to 3 sentence explanation of "why."
    metrics: Dict[str, Any] # Hard numbers: selic, fed_rate, rsi, commodity deltas, etc.
    risk_flags: List[str] # e.g. ["election_volatility", "commodity_headwind", "geopolitical_risk"]

def _merge_dicts(a: Dict, b: Dict) -> Dict:
    "Reducer for parallel branch fan-in: merges two dicts, b overrides a."""
    return {**a, *b}

class AuraState(TypedDict):
    # Current financial snapshot
    brl_balance: float
    usd_balance: float
    current_fx_rate: float
    
    # Intelligence data
    pending_liabilities: List[dict]  # From Visionary Accountant

    # Parallel researcher outputs (Annotated so LangGraph merges them correctly on fan-in)
    macro_findings: Annotated[Dict[str, Any], _merge_dicts]
    commodity_findings: Annotated[Dict[str, Any], _merge_dicts]
    sentiment_findings: Annotated[Dict[str, Any], _merge_dicts]
 
    # Synthesised market analysis (replaces the old binary market_prediction string)
    market_analysis: MarketAnalysis
 
    # Keep market_prediction for backwards compatibility with any existing consumers
    market_prediction: str
    
    # Execution data
    route_options: List[dict]
    selected_route: Optional[str]   # From Smart Router
    audit_hash: Optional[str]        # From Trust Engine
    
    # List of {id, name, pay: bool, reason: str}
    payment_decisions: List[dict]
