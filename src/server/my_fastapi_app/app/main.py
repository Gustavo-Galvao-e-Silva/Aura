import asyncio
import os
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Depends

# Fixed absolute imports
from agents.state import AuraState
from agents.agents import visionary_accountant_node

from agents.aura_graph import aura_graph

from db.session import engine
from db.models import Base

from sqlalchemy.orm import Session
from db.session import get_db
from db.models import Liability

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
    global current_state
    while True:
        print("Aura heartbeat: Updating market and routes...")
        # Role 1 will eventually invoke the graph here

        result = aura_graph.invoke(current_state)
        current_state.update(result)

        await asyncio.sleep(60) # Set to 60s for demo/dev

@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine) 
    asyncio.create_task(monitor_market_loop())

@app.get("/status")
async def get_status():
    return current_state

@app.post("/upload-invoice")
async def upload_invoice(file: UploadFile = File(...), db: Session = Depends(get_db)):
    image_bytes = await file.read()
    
    # 1. Fetch history from DB to provide context
    past_liabilities = db.query(Liability).limit(10).all()
    history_str = "\n".join([f"{l.name}: ${l.amount} due {l.due_date}" for l in past_liabilities])

    # 2. Run Vision Agent with History Context
    extraction_result = visionary_accountant_node(image_bytes, history_context=history_str)
    
    if not extraction_result:
        return {"status": "error", "message": "Extraction failed"}

    # 3. Save Actual Liabilities
    for item in extraction_result.get("actual_liabilities", []):
        db.add(Liability(**item, is_predicted=False))
        
    # 4. Save Predicted Liabilities (The intelligent inference)
    for item in extraction_result.get("predicted_liabilities", []):
        db.add(Liability(**item, is_predicted=True))
        
    db.commit()
    
    return {
        "status": "success", 
        "actual_count": len(extraction_result.get("actual_liabilities", [])),
        "predicted_count": len(extraction_result.get("predicted_liabilities", []))
    }
