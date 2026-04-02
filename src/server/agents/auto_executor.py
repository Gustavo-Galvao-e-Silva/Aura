"""
Auto-Executor - Automatic payment execution for high-confidence decisions.

This is a graph node that monitors agent recommendations and automatically
executes payments when confidence is high (≥90%).

Part of the Aura agent workflow:
orchestrator → auto_executor → trust_engine → END
"""
from datetime import datetime
from typing import Dict
import httpx
from agents.state import AuraState
from my_fastapi_app.app.settings import settings


# Confidence threshold for auto-execution
AUTO_EXECUTE_CONFIDENCE_THRESHOLD = 0.9  # 90%


async def execute_payment(liability_id: int, username: str) -> Dict:
    """
    Execute a single payment via the settlement endpoint.

    Args:
        liability_id: Database ID of the liability to pay
        username: Username of the user

    Returns:
        {"success": bool, "transaction_id": int, "error": str}
    """
    try:
        # Call the internal settlement endpoint
        # Note: This uses httpx to call the API endpoint since we're in a background task
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.API_BASE_URL}/payments/settle",
                json={
                    "username": username,
                    "liability_id": liability_id
                }
            )

            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "transaction_id": result.get("transaction_id"),
                    "error": None
                }
            else:
                error_detail = response.json().get("detail", response.text)
                return {
                    "success": False,
                    "transaction_id": None,
                    "error": f"HTTP {response.status_code}: {error_detail}"
                }

    except Exception as e:
        return {
            "success": False,
            "transaction_id": None,
            "error": str(e)
        }


async def auto_executor_node(state: AuraState):
    """
    Graph node: Auto-executes high-confidence payment decisions.

    Runs as part of the Aura agent workflow (every heartbeat ~60s).
    Checks for:
    - Decisions with pay=true
    - Market confidence ≥ 90%
    - Bills not yet paid

    When found, automatically executes the payment via settlement endpoint.

    Args:
        state: Current AuraState from the graph

    Returns:
        Updated state with execution results
    """
    print(f"🤖 Auto-Executor: Checking for high-confidence payments...")

    decisions = state.get("payment_decisions", [])

    if not decisions:
        print("   No payment decisions found in state")
        return {"auto_executor_results": []}

    # Filter for auto-executable decisions
    auto_executable = [
        d for d in decisions
        if (
            d.get("pay") is True and  # Orchestrator recommended "pay now"
            d.get("market_confidence", 0.0) >= AUTO_EXECUTE_CONFIDENCE_THRESHOLD  # High confidence
        )
    ]

    if not auto_executable:
        print(f"   No high-confidence (≥{AUTO_EXECUTE_CONFIDENCE_THRESHOLD:.0%}) payments found")
        print(f"   Total decisions: {len(decisions)}, "
              f"Pay recommendations: {sum(1 for d in decisions if d.get('pay'))}")
        return {"auto_executor_results": []}

    print(f"   🎯 Found {len(auto_executable)} high-confidence payment(s) to execute:")

    execution_results = []

    # Execute each payment
    for decision in auto_executable:
        liability_id = decision.get("liability_id")
        username = decision.get("username")
        name = decision.get("name")
        amount_usd = decision.get("amount_usd", 0.0)
        confidence = decision.get("market_confidence", 0.0)
        reason = decision.get("reason", "")

        print(f"\n   ▶️  Executing: {name} (${amount_usd:.2f}) for @{username}")
        print(f"      Liability ID: {liability_id}")
        print(f"      Confidence: {confidence:.0%}")
        print(f"      Reason: {reason}")

        result = await execute_payment(liability_id, username)

        if result["success"]:
            print(f"      ✅ Success! Transaction ID: {result['transaction_id']}")
            execution_results.append({
                "liability_id": liability_id,
                "username": username,
                "status": "executed",
                "transaction_id": result["transaction_id"],
                "executed_at": datetime.now().isoformat()
            })
        else:
            error = result["error"]
            # Check if error is "already paid" (non-critical)
            if "already paid" in error.lower():
                print(f"      ℹ️  Already paid (skipping)")
                execution_results.append({
                    "liability_id": liability_id,
                    "username": username,
                    "status": "already_paid",
                    "error": error
                })
            else:
                print(f"      ❌ Failed: {error}")
                execution_results.append({
                    "liability_id": liability_id,
                    "username": username,
                    "status": "failed",
                    "error": error
                })

    print(f"\n✅ Auto-Executor: Processed {len(auto_executable)} high-confidence payments")
    return {"auto_executor_results": execution_results}
