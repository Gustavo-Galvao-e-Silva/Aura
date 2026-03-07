import asyncio
import os
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Fixed absolute imports
from agents.state import AuraState
from agents.agents import visionary_accountant_node

from agents.aura_graph import aura_graph

from sqlalchemy.orm import Session

from db.models import Base, Liability, Users
from my_fastapi_app.app.db.session import engine, get_db

app = FastAPI(title="Aura: Global Finance Co-Pilot")

class CreateUserDTO(BaseModel):
    fullName: str
    username: str
    email: str


class CreateExpenseDTO(BaseModel):
    name: str
    amount: float
    currency: Literal["USD", "BRL"]
    due_date: date
    category: str


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
async def upload_invoice(
    username: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    image_bytes = await file.read()

    # 1. Fetch this user's history from DB to provide context
    past_liabilities = (
        db.query(Liability)
        .filter(Liability.username == username)
        .limit(10)
        .all()
    )

    history_str = "\n".join(
        [f"{l.name}: ${l.amount} due {l.due_date}" for l in past_liabilities]
    )

    # 2. Run Vision Agent with History Context
    extraction_result = visionary_accountant_node(
        image_bytes,
        history_context=history_str,
    )

    if not extraction_result:
        return {"status": "error", "message": "Extraction failed"}

    # 3. Save Actual Liabilities for this user
    for item in extraction_result.get("actual_liabilities", []):
        db.add(
            Liability(
                **item,
                username=username,
                is_predicted=False,
            )
        )

    # 4. Save Predicted Liabilities for this user
    for item in extraction_result.get("predicted_liabilities", []):
        db.add(
            Liability(
                **item,
                username=username,
                is_predicted=True,
            )
        )

    db.commit()

    return {
        "status": "success",
        "actual_count": len(extraction_result.get("actual_liabilities", [])),
        "predicted_count": len(extraction_result.get("predicted_liabilities", [])),
    }

@app.get("/get-user-expenses")
async def get_user_expenses(db: Session = Depends(get_db)):
    past_liabilities = db.query(Liability).all()
    return {
        "user-expenses": past_liabilities
    }

@app.post("/post-create-user")
async def post_create_user(
    data: CreateUserDTO,
    db: Session = Depends(get_db),
):
    new_user = Users(
        fullname=data.fullName,
        username=data.username,
        email=data.email,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@app.post("/create-expense")
async def post_create_expense(
    data: CreateExpenseDTO,
    db: Session = Depends(get_db),
):
    new_liability = Liability(
        username=data.username,
        name=data.name,
        amount=data.amount,
        currency=data.currency,
        due_date=data.due_date,
        category=data.category,
        is_predicted=False,
        is_paid=False,
    )

    db.add(new_liability)
    db.commit()
    db.refresh(new_liability)

    return new_liability