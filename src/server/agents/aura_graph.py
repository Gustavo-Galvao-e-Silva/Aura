from langgraph.graph import StateGraph, END
from agents.state import AuraState
from agents.agents import fx_strategist_node
from agents.router import smart_router_node
from agents.trust import trust_engine_node
from agents.orchestrator import orchestrator_node

def build_aura_graph():
    # 1. Initialize the Graph with our shared State
    workflow = StateGraph(AuraState)

    # 2. Add our Nodes
    workflow.add_node("fx_strategist", fx_strategist_node)
    workflow.add_node("smart_router", smart_router_node)
    workflow.add_node("orchestrator", orchestrator_node)
    workflow.add_node("trust_engine", trust_engine_node)

    # 3. Define the Flow (Linear Execution for the POC)
    # The flow must be: Intel -> Facts -> Decisions -> Audit
    workflow.set_entry_point("fx_strategist")
    
    workflow.add_edge("fx_strategist", "smart_router")
    workflow.add_edge("smart_router", "orchestrator")
    
    # CRITICAL FIX: The orchestrator must pass the decision to the trust engine
    workflow.add_edge("orchestrator", "trust_engine")
    
    # The graph ends only after the decision is hashed and posted to Stellar
    workflow.add_edge("trust_engine", END)

    # 4. Compile
    return workflow.compile()

# This is what FastAPI invokes in the heartbeat loop
aura_graph = build_aura_graph()
