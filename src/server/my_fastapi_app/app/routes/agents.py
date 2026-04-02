from typing import Optional
from fastapi import APIRouter, Query

from my_fastapi_app.app.state import get_current_state

router = APIRouter(prefix="/agents", tags=["Agent Status"])


@router.get("/status")
async def get_status(username: Optional[str] = Query(default=None)):
    """
    Get the current state of the AI agent system.

    If `username` is provided, payment_decisions are filtered to only that user's liabilities.
    """
    state = get_current_state()

    if username:
        filtered_decisions = [
            d for d in state.get("payment_decisions", [])
            if d.get("username") == username
        ]
        return {**state, "payment_decisions": filtered_decisions}

    return state
