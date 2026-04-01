from typing import TypedDict, List, Optional, Dict, Any, Annotated


# ============================================================================
# Typed Market Metrics Structure (Phase 1 Step 1.1)
# ============================================================================

class MarketMetrics(TypedDict, total=False):
    """
    Typed market metrics structure matching what synthesis_node produces.

    Using total=False allows optional fields (not all data may be available).
    This provides type safety and IDE autocomplete while remaining flexible.
    """
    # Macro indicators (from macro_researcher_node)
    selic_rate: Optional[float]
    fed_funds_rate: Optional[float]
    rate_differential: Optional[float]
    focus_ipca_12m: Optional[float]
    focus_selic_eoy: Optional[float]
    us_cpi_yoy: Optional[float]
    yield_curve_10y2y: Optional[float]
    brazil_gdp_growth: Optional[float]
    usa_gdp_growth: Optional[float]

    # Commodity indicators (from commodity_researcher_node)
    commodity_sentiment: Optional[str]  # "bullish" | "bearish" | "neutral"
    oil_price: Optional[float]
    soy_price: Optional[float]
    iron_price: Optional[float]

    # Sentiment indicators (from sentiment_researcher_node)
    fiscal_health_score: Optional[int]  # 1-10
    geopolitical_risk_score: Optional[int]  # 1-10
    political_stability_score: Optional[int]  # 1-10


class MarketAnalysis(TypedDict):
    """
    Structured market analysis output from synthesis_node.
    This is what the orchestrator consumes to make pay/wait decisions.
    """
    prediction: str  # "BULLISH" | "BEARISH" | "NEUTRAL"
    confidence: float  # 0.0 to 1.0
    thesis: str  # 2-3 sentence explanation of the prediction
    metrics: MarketMetrics  # ← Now strongly typed!
    risk_flags: List[str]  # e.g., ["fiscal_concerns", "election_volatility"]
    fetched_at: str  # ← NEW: ISO 8601 timestamp of when data was collected

def _merge_dicts(a: Dict, b: Dict) -> Dict:
    """Reducer for parallel branch fan-in: merges two dicts, b overrides a."""
    return {**a, **b}

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
