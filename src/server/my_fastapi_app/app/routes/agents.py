from fastapi import APIRouter

from my_fastapi_app.app.state import get_current_state

router = APIRouter(prefix="/agents", tags=["Agent Status"])


@router.get("/status")
async def get_status():
    """
    Get the current state of the AI agent system.

    Returns the current market prediction, pending liabilities, FX rates,
    route options, and other agent state information.
    """
    return get_current_state()
