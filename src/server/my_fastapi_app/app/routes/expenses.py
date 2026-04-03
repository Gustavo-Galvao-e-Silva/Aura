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


class ConfirmPredictedExpenseDTO(BaseModel):
    """
    DTO for confirming a predicted bill and optionally updating its details.
    All fields are optional - if not provided, keep the predicted values.
    """
    name: str | None = None
    amount: float | None = None
    currency: Literal["USD", "BRL"] | None = None
    due_date: str | None = None
    category: str | None = None


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
        if isinstance(item.get("due_date"), str):
            item["due_date"] = date.fromisoformat(item["due_date"])
        db.add(Liability(**item, username=username, is_predicted=False))

    for item in extraction_result.get("predicted_liabilities", []):
        if isinstance(item.get("due_date"), str):
            item["due_date"] = date.fromisoformat(item["due_date"])
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

    # Convert due_date string to date object for database
    due_date_obj = date.fromisoformat(data.due_date) if isinstance(data.due_date, str) else data.due_date

    new_liability = Liability(
        username=data.username,
        name=data.name,
        amount=data.amount,
        currency=data.currency,
        due_date=due_date_obj,
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

    # Convert due_date string to date object for database
    due_date_obj = date.fromisoformat(data.due_date) if isinstance(data.due_date, str) else data.due_date

    expense.username = data.username
    expense.name = data.name
    expense.amount = data.amount
    expense.currency = data.currency
    expense.due_date = due_date_obj
    expense.category = data.category
    expense.is_paid = data.is_paid

    await db.commit()
    await db.refresh(expense)

    return {
        "status": "success",
        "expense": expense,
    }


@router.post("/{expense_id}/confirm")
async def confirm_predicted_expense(
    expense_id: int,
    data: ConfirmPredictedExpenseDTO,
    db: AsyncSession = Depends(get_db),
):
    """
    Confirm a predicted bill and convert it to an actual liability.

    This allows users to review predicted bills from the Visionary Accountant,
    make adjustments if needed, and confirm them for auto-execution eligibility.

    - **expense_id**: Unique expense identifier
    - **data**: Optional updates to the predicted bill (name, amount, currency, due_date, category)

    Returns the confirmed expense details with is_predicted=false.
    """
    result = await db.execute(select(Liability).filter(Liability.id == expense_id))
    expense = result.scalar_one_or_none()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if not expense.is_predicted:
        raise HTTPException(
            status_code=400,
            detail="This expense is already confirmed (not a predicted bill)"
        )

    # Apply updates if provided
    if data.name is not None:
        expense.name = data.name

    if data.amount is not None:
        if data.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than 0")
        expense.amount = data.amount

    if data.currency is not None:
        expense.currency = data.currency

    if data.due_date is not None:
        expense.due_date = date.fromisoformat(data.due_date) if isinstance(data.due_date, str) else data.due_date

    if data.category is not None:
        expense.category = data.category

    # Confirm the bill (now eligible for auto-execution)
    expense.is_predicted = False

    await db.commit()
    await db.refresh(expense)

    return {
        "status": "confirmed",
        "message": "Predicted bill confirmed and now eligible for auto-execution",
        "expense": expense,
    }


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete an existing expense.

    - **expense_id**: Unique expense identifier

    Returns success status after deletion.
    """
    result = await db.execute(select(Liability).filter(Liability.id == expense_id))
    expense = result.scalar_one_or_none()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    await db.delete(expense)
    await db.commit()

    return {
        "status": "success",
        "message": "Expense deleted successfully",
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
        ).order_by(Liability.due_date).limit(1)
    )
    next_liability = next_result.scalar_one_or_none()

    return {
        "count": count,
        "next_liability": next_liability
    }
