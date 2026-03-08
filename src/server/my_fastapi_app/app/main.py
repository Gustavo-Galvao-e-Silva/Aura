import asyncio
import os
from fastapi import FastAPI, Depends, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal, Optional

# Fixed absolute imports
from agents.state import AuraState
from agents.agents import visionary_accountant_node

from agents.aura_graph import aura_graph

from sqlalchemy.orm import Session

from db.models import Base, Liability, Users
from my_fastapi_app.app.db.session import engine, get_db

from datetime import date, timedelta
from typing import Literal

from fastapi import Depends, Query
from sqlalchemy.orm import Session


app = FastAPI(title="Aura: Global Finance Co-Pilot")

class CreateUserDTO(BaseModel):
    fullName: str
    username: str
    email: str



class CreateExpenseDTO(BaseModel):
    username: str
    name: str
    amount: float
    currency: Literal["USD", "BRL"]
    due_date: str
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
    username: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    image_bytes = await file.read()

    past_liabilities = (
        db.query(Liability)
        .filter(Liability.username == username)
        .limit(10)
        .all()
    )

    history_str = "\n".join(
        [f"{l.name}: ${l.amount} due {l.due_date}" for l in past_liabilities]
    )

    extraction_result = visionary_accountant_node(
        image_bytes,
        history_context=history_str,
    )

    if not extraction_result:
        return {"status": "error", "message": "Extraction failed"}

    for item in extraction_result.get("actual_liabilities", []):
        db.add(Liability(**item, username=username, is_predicted=False))

    for item in extraction_result.get("predicted_liabilities", []):
        db.add(Liability(**item, username=username, is_predicted=True))

    db.commit()

    return {
        "status": "success",
        "actual_count": len(extraction_result.get("actual_liabilities", [])),
        "predicted_count": len(extraction_result.get("predicted_liabilities", [])),
    }


@app.get("/get-user-expenses")
async def get_user_expenses(
    filter_by: Literal["all", "upcoming", "paid", "overdue", "predicted"] = Query("all"),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Liability)

    if filter_by == "all":
        query = query.filter(Liability.is_predicted == False)

    elif filter_by == "upcoming":
        query = query.filter(
            Liability.is_predicted == False,
            Liability.is_paid == False,
            Liability.due_date >= date.today(),
        )

    elif filter_by == "paid":
        query = query.filter(
            Liability.is_predicted == False,
            Liability.is_paid == True,
        )

    elif filter_by == "overdue":
        query = query.filter(
            Liability.is_predicted == False,
            Liability.is_paid == False,
            Liability.due_date < date.today(),
        )

    elif filter_by == "predicted":
        query = query.filter(Liability.is_predicted == True)

    query = query.order_by(Liability.due_date)

    if limit is not None:
        query = query.limit(limit)

    past_liabilities = query.all()

    return {"user-expenses": past_liabilities}


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

@app.get("/get-expense-stats")
async def get_expense_stats(
    username: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Liability).filter(Liability.is_predicted == False)

    if username:
        query = query.filter(Liability.username == username)

    all_expenses = query.all()
    today = date.today()
    week_from_now = today + timedelta(days=7)

    total_to_be_paid = sum(
        expense.amount for expense in all_expenses if not expense.is_paid
    )

    upcoming_total = sum(
        expense.amount
        for expense in all_expenses
        if (not expense.is_paid and today <= expense.due_date <= week_from_now)
    )

    overdue_total = sum(
        expense.amount
        for expense in all_expenses
        if (not expense.is_paid and expense.due_date < today)
    )

    return {
        "total_to_be_paid": total_to_be_paid,
        "upcoming_total": upcoming_total,
        "overdue_total": overdue_total,
    }