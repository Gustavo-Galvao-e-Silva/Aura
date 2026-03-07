import asyncio
import os
from fastapi import FastAPI, UploadFile, File, BackgroundTasks

# Fixed absolute imports
from agents.state import AuraState
from agents.agents import visionary_accountant_node

app = FastAPI(title="Aura: Global Finance Co-Pilot")

# Shared state
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
    """Background heartbeat for Role 1 & 3"""
    while True:
        print("Aura heartbeat: Checking markets...")
        # Role 1 will eventually invoke the graph here
        await asyncio.sleep(60) # Set to 60s for demo/dev

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(monitor_market_loop())

@app.get("/status")
async def get_status():
    return current_state

@app.post("/upload-invoice")
async def upload_invoice(file: UploadFile = File(...)):
    """Role 2 Entry Point"""
    image_bytes = await file.read()
    new_liability = visionary_accountant_node(image_bytes)

    if new_liability:
        current_state["pending_liabilities"].append(new_liability)
        return {"status": "success", "data": new_liability}
    
    return {"status": "error", "message": "Extraction failed"}
