"""
Auto-Executor - Automatic payment execution for orchestrator recommendations.

This is a graph node that executes payments recommended by the orchestrator.
It trusts the orchestrator's reasoning (which already considers urgency, confidence, risk flags, etc.)
and simply executes what was recommended.

Safety rule: Only auto-execute CONFIRMED bills (is_predicted=false).
Predicted bills require user confirmation first.

Part of the Aura agent workflow:
orchestrator → auto_executor → trust_engine → END
"""
from datetime import datetime
from typing import Dict
import httpx
from agents.state import AuraState
from my_fastapi_app.app.settings import settings


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
    Graph node: Auto-executes orchestrator's "pay now" recommendations.

    Runs as part of the Aura agent workflow (every heartbeat ~60s).

    Logic: Trust the orchestrator's decisions completely.
    - If orchestrator says pay=true → execute
    - Safety: Skip predicted bills (require user confirmation first)

    The orchestrator already considers:
    - Urgency (bills due soon)
    - Market confidence
    - Risk flags
    - Cost estimates

    No need to second-guess with additional thresholds.

    Args:
        state: Current AuraState from the graph

    Returns:
        Updated state with execution results
    """
    print(f"🤖 Auto-Executor: Checking orchestrator recommendations...")

    decisions = state.get("payment_decisions", [])

    if not decisions:
        print("   No payment decisions found in state")
        return {"auto_executor_results": []}

    # Filter for auto-executable decisions: trust orchestrator, but skip predicted bills
    auto_executable = [
        d for d in decisions
        if (
            d.get("pay") is True and  # Orchestrator recommended "pay now"
            not d.get("is_predicted", False)  # Only execute CONFIRMED bills
        )
    ]

    if not auto_executable:
        pay_count = sum(1 for d in decisions if d.get("pay"))
        predicted_count = sum(1 for d in decisions if d.get("pay") and d.get("is_predicted"))

        print(f"   No auto-executable payments found")
        print(f"   Total decisions: {len(decisions)}, "
              f"Pay recommendations: {pay_count} "
              f"(including {predicted_count} predicted bills awaiting confirmation)")
        return {"auto_executor_results": []}

    print(f"   🎯 Found {len(auto_executable)} confirmed payment(s) to execute (trusting orchestrator):")

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

    print(f"\n✅ Auto-Executor: Processed {len(auto_executable)} orchestrator recommendations")
    return {"auto_executor_results": execution_results}
