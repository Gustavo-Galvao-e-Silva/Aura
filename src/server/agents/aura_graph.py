from langgraph.graph import StateGraph, START, END
from agents.state import AuraState
from agents.agents import fx_strategist_node  # Legacy fallback, can be removed later
from agents.router import smart_router_node
from agents.user_coordinator import user_coordinator_node
from agents.researchers import (
    macro_researcher_node,
    commodity_researcher_node,
    sentiment_researcher_node,
    market_synthesis_node,
)
# Note: trust_engine_node is now called inside user_coordinator for per-user audit trails

def build_aura_graph():
    """
    Build the Aura agent graph with fan-out research architecture.

    Flow:
        START
         ├─→ macro_researcher     (BCB, FRED, World Bank)
         ├─→ commodity_researcher (Yahoo Finance)
         └─→ sentiment_researcher (Tavily + Browser Use)
               ↓ (fan-in via Annotated reducers in AuraState)
             synthesis             (Gemini creates MarketAnalysis)
               ↓
             smart_router          (Get FX provider quotes)
               ↓
             user_coordinator      (Per-user orchestrator + auto-executor + trust_engine)
               └─ For each user:
                    orchestrator (user-specific decisions)
                    auto_executor (execute confirmed payments)
                    trust_engine (per-user audit trail)
               ↓
             END

    Note: trust_engine now runs inside user_coordinator for per-user audit trails.
    """
    # 1. Initialize the Graph with our shared State
    workflow = StateGraph(AuraState)

    # 2. Add the Parallel Research Nodes (Fan-out)
    workflow.add_node("macro_researcher", macro_researcher_node)
    workflow.add_node("commodity_researcher", commodity_researcher_node)
    workflow.add_node("sentiment_researcher", sentiment_researcher_node)

    # 3. Add the Synthesis Node (Fan-in)
    workflow.add_node("synthesis", market_synthesis_node)

    # 4. Add the Execution Nodes
    workflow.add_node("smart_router", smart_router_node)
    workflow.add_node("user_coordinator", user_coordinator_node)
    # Note: trust_engine_node is now called inside user_coordinator per-user

    # 5. Define the Flow
    # Fan-out: START triggers all three researchers in parallel
    workflow.add_edge(START, "macro_researcher")
    workflow.add_edge(START, "commodity_researcher")
    workflow.add_edge(START, "sentiment_researcher")

    # Fan-in: All three researchers feed into synthesis
    # LangGraph will automatically merge their outputs via the Annotated reducers in AuraState
    workflow.add_edge("macro_researcher", "synthesis")
    workflow.add_edge("commodity_researcher", "synthesis")
    workflow.add_edge("sentiment_researcher", "synthesis")

    # Linear flow: synthesis -> router -> user_coordinator (includes per-user trust_engine) -> END
    workflow.add_edge("synthesis", "smart_router")
    workflow.add_edge("smart_router", "user_coordinator")
    workflow.add_edge("user_coordinator", END)

    # 6. Compile
    return workflow.compile()

# This is what FastAPI invokes in the heartbeat loop
aura_graph = build_aura_graph()
