import asyncio
import os
from fastapi import FastAPI, Depends, File, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal, Optional

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

import os
import httpx

from dotenv import load_dotenv
load_dotenv()

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

        result = await aura_graph.ainvoke(current_state)
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
    username: str = Query(...),
    filter_by: Literal["all", "upcoming", "paid", "overdue", "predicted"] = Query("all"),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Liability).filter(Liability.username == username)

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

@app.post("/create-expense")
async def post_create_expense(
    data: CreateExpenseDTO,
    db: Session = Depends(get_db),
):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    user = db.query(Users).filter(Users.username == data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

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

    return {
        "status": "success",
        "expense": new_liability,
    }


@app.get("/get-fx-provider-rates")
async def get_fx_provider_rates():
    crebit_url = "https://api.crebitpay.com/api/create-quote-new"
    wise_url = "https://api.wise.com/v3/quotes"
    remitly_url = "https://api.remitly.io/v3/calculator/estimate"

    wise_api_key = os.getenv("WISE_API_KEY")

    parsed = {
        "crebit": None,
        "wise": None,
        "remitly": None,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        # CREBIT
        try:
            crebit_response = await client.post(
                crebit_url,
                json={
                    "symbol": "USDC/BRL",
                    "quote_type": "on_ramp",
                },
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
            crebit_json = crebit_response.json()

            parsed["crebit"] = {
                "provider": "crebit",
                "rate": float(crebit_json["quotation"]) if crebit_json.get("quotation") else None,
            }
        except Exception as e:
            parsed["crebit"] = {
                "provider": "crebit",
                "rate": None,
                "error": str(e),
            }

        # WISE
        try:
            wise_headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
            }

            if wise_api_key:
                wise_headers["Authorization"] = f"Bearer {wise_api_key}"

            wise_response = await client.post(
                wise_url,
                json={
                    "sourceCurrency": "USD",
                    "targetCurrency": "BRL",
                    "sourceAmount": 1,
                },
                headers=wise_headers,
            )

            wise_json = wise_response.json()

            wise_rate = (
                wise_json.get("rate")
                or wise_json.get("price", {}).get("rate")
                or wise_json.get("paymentOptions", [{}])[0].get("rate")
            )

            parsed["wise"] = {
                "provider": "wise",
                "rate": float(wise_rate) if wise_rate is not None else None,
            }
        except Exception as e:
            parsed["wise"] = {
                "provider": "wise",
                "rate": None,
                "error": str(e),
            }

        # REMITLY
        try:
            remitly_response = await client.get(
                remitly_url,
                params={
                    "conduit": "USA:USD-BRA:BRL",
                    "anchor": "SEND",
                    "amount": 100,
                    "purpose": "OTHER",
                    "customer_segment": "STANDARD",
                    "customer_recognition": "UNRECOGNIZED",
                    "strict_promo": "false",
                },
                headers={
                    "Accept": "application/json",
                },
            )

            remitly_json = remitly_response.json()
            exchange_rate = remitly_json.get("estimate", {}).get("exchange_rate", {})

            remitly_rate = (
                exchange_rate.get("promotional_exchange_rate")
                or exchange_rate.get("base_rate")
            )

            parsed["remitly"] = {
                "provider": "remitly",
                "rate": float(remitly_rate) if remitly_rate is not None else None,
            }
        except Exception as e:
            parsed["remitly"] = {
                "provider": "remitly",
                "rate": None,
                "error": str(e),
            }

    return parsed
 
