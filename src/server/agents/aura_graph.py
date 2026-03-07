from langgraph.graph import StateGraph, END
from agents.state import AuraState
from agents.agents import fx_strategist_node
from agents.router import smart_router_node
from agents.trust import trust_engine_node

def build_aura_graph():
    # 1. Initialize the Graph with our State
    workflow = StateGraph(AuraState)

    # 2. Add our Nodes
    workflow.add_node("fx_strategist", fx_strategist_node)
    workflow.add_node("find_route", smart_router_node)
    workflow.add_node("audit_decision", trust_engine_node)

    # Note: visionary_accountant_node is usually called directly via 
    # the FastAPI endpoint, but you could add it here too!

    # 3. Define the Flow
    workflow.set_entry_point("fx_strategist")
    workflow.add_edge("fx_strategist", "find_route")
    workflow.add_edge("find_route", "audit_decision")
    workflow.add_edge("audit_decision", END)

    # 4. Compile
    return workflow.compile()

aura_graph = build_aura_graph()
