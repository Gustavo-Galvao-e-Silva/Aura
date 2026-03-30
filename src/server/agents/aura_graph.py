from langgraph.graph import StateGraph, START, END
from agents.state import AuraState
from agents.agents import fx_strategist_node  # Legacy fallback, can be removed later
from agents.router import smart_router_node
from agents.trust import trust_engine_node
from agents.orchestrator import orchestrator_node
from agents.researchers import (
    macro_researcher_node,
    commodity_researcher_node,
    sentiment_researcher_node,
    market_synthesis_node,
)

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
             orchestrator          (Make pay/wait decisions)
               ↓
             trust_engine          (Hash to Stellar blockchain)
               ↓
             END
    """
    # 1. Initialize the Graph with our shared State
    workflow = StateGraph(AuraState)

    # 2. Add the Parallel Research Nodes (Fan-out)
    workflow.add_node("macro_researcher", macro_researcher_node)
    workflow.add_node("commodity_researcher", commodity_researcher_node)
    workflow.add_node("sentiment_researcher", sentiment_researcher_node)

    # 3. Add the Synthesis Node (Fan-in)
    workflow.add_node("synthesis", market_synthesis_node)

    # 4. Add the Execution Nodes (unchanged from original)
    workflow.add_node("smart_router", smart_router_node)
    workflow.add_node("orchestrator", orchestrator_node)
    workflow.add_node("trust_engine", trust_engine_node)

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

    # Linear flow: synthesis -> router -> orchestrator -> trust -> END
    workflow.add_edge("synthesis", "smart_router")
    workflow.add_edge("smart_router", "orchestrator")
    workflow.add_edge("orchestrator", "trust_engine")
    workflow.add_edge("trust_engine", END)

    # 6. Compile
    return workflow.compile()

# This is what FastAPI invokes in the heartbeat loop
aura_graph = build_aura_graph()
