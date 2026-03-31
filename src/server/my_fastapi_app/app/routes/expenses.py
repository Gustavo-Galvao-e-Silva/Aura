from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agents.agents import visionary_accountant_node
from db.models import Liability, Users
from my_fastapi_app.app.db.session import get_db

router = APIRouter(prefix="/expenses", tags=["Expenses"])


class CreateExpenseDTO(BaseModel):
    username: str
    name: str
    amount: float
    currency: Literal["USD", "BRL"]
    due_date: str
    category: str


class UpdateExpenseDTO(BaseModel):
    username: str
    name: str
    amount: float
    currency: Literal["USD", "BRL"]
    due_date: str
    category: str
    is_paid: bool


@router.post("/upload-invoice")
async def upload_invoice(
    username: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload an invoice or bill image for OCR processing.

    Uses Google Gemini Vision to extract expense details from the uploaded image,
    including automatic liability prediction based on user's expense history.

    - **username**: User identifier
    - **file**: Image file (JPEG, PNG, etc.)

    Returns the number of actual and predicted liabilities extracted.
    """
    image_bytes = await file.read()

    result = await db.execute(
        select(Liability)
        .filter(Liability.username == username)
        .limit(10)
    )
    past_liabilities = result.scalars().all()

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

    await db.commit()

    return {
        "status": "success",
        "actual_count": len(extraction_result.get("actual_liabilities", [])),
        "predicted_count": len(extraction_result.get("predicted_liabilities", [])),
    }


@router.get("/user/{username}")
async def get_user_expenses(
    username: str,
    filter_by: Literal["all", "upcoming", "paid", "overdue", "predicted"] = Query("all"),
    limit: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve user expenses with optional filtering.

    - **username**: User identifier
    - **filter_by**: Filter expenses by status (all, upcoming, paid, overdue, predicted)
    - **limit**: Maximum number of expenses to return (optional)

    Returns a list of expenses matching the filter criteria.
    """
    query = select(Liability).filter(Liability.username == username)

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

    result = await db.execute(query)
    past_liabilities = result.scalars().all()

    return {"user-expenses": past_liabilities}


@router.get("/stats")
async def get_expense_stats(
    username: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get expense statistics and totals.

    - **username**: User identifier (optional, defaults to all users)

    Returns total to be paid, upcoming total, and overdue total.
    """
    query = select(Liability).filter(Liability.is_predicted == False)

    if username:
        query = query.filter(Liability.username == username)

    result = await db.execute(query)
    all_expenses = result.scalars().all()
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


@router.post("/create")
async def post_create_expense(
    data: CreateExpenseDTO,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new expense manually.

    - **username**: User identifier
    - **name**: Expense name/description
    - **amount**: Expense amount
    - **currency**: Currency code (USD or BRL)
    - **due_date**: Due date (YYYY-MM-DD format)
    - **category**: Expense category (Education, Housing, Food, etc.)

    Returns the created expense details.
    """
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    result = await db.execute(select(Users).filter(Users.username == data.username))
    user = result.scalar_one_or_none()
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
    await db.commit()
    await db.refresh(new_liability)

    return {
        "status": "success",
        "expense": new_liability,
    }


@router.put("/{expense_id}")
async def update_expense(
    expense_id: int,
    data: UpdateExpenseDTO,
    db: AsyncSession = Depends(get_db),
):
    """
    Update an existing expense.

    - **expense_id**: Unique expense identifier
    - **data**: Updated expense details (name, amount, currency, due_date, category, is_paid)

    Returns the updated expense details.
    """
    result = await db.execute(select(Liability).filter(Liability.id == expense_id))
    expense = result.scalar_one_or_none()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    result = await db.execute(select(Users).filter(Users.username == data.username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    expense.username = data.username
    expense.name = data.name
    expense.amount = data.amount
    expense.currency = data.currency
    expense.due_date = data.due_date
    expense.category = data.category
    expense.is_paid = data.is_paid

    await db.commit()
    await db.refresh(expense)

    return {
        "status": "success",
        "expense": expense,
    }


@router.get("/dashboard")
async def get_dashboard_expenses(
    username: str | None = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Get dashboard summary for expenses.

    - **username**: User identifier (optional)

    Returns total expense count and next upcoming liability.
    """
    from sqlalchemy import func

    count_result = await db.execute(
        select(func.count()).select_from(Liability).filter(
            Liability.is_predicted == False,
            Liability.username == username
        )
    )
    count = count_result.scalar()

    next_result = await db.execute(
        select(Liability).filter(
            Liability.is_predicted == False,
            Liability.username == username,
            Liability.is_paid == False
        ).order_by(Liability.due_date)
    )
    next_liability = next_result.scalar_one_or_none()

    return {
        "count": count,
        "next_liability": next_liability
    }
