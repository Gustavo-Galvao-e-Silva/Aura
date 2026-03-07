import asyncio
from fastapi import FastAPI, BackgroundTasks
from state import AuraState
from agents import aura_graph # This is what Role 1 will build

app = FastAPI(title="Aura: Global Finance Co-Pilot")

# Initial Mock State (Role 2 will eventually connect this to Plaid)
current_state: AuraState = {
    "brl_balance": 50000.0,
    "usd_balance": 0.0,
    "current_fx_rate": 0.0,
    "pending_liabilities": [],
    "market_prediction": "NEUTRAL",
    "selected_route": None,
    "audit_hash": None
}

async def monitor_market_loop():
    """
    The background 'Heartbeat' that keeps Aura active.
    """
    while True:
        print("Aura is waking up to check the market...")
        # Role 1: Invoke the LangGraph here
        # result = aura_graph.invoke(current_state)
        # update current_state with result
        
        # Wait for 1 hour before checking again (or 60s for demo purposes)
        await asyncio.sleep(3600) 

@app.on_event("startup")
async def startup_event():
    # Start the monitoring loop in the background when the server starts
    asyncio.create_task(monitor_market_loop())

@app.get("/status")
async def get_status():
    return current_state

@app.post("/upload-invoice")
async def upload_invoice(file_data: dict):
    # Role 2: This is where you'll trigger the Visionary Accountant
    return {"message": "Invoice received and being processed by Visionary Accountant"}
