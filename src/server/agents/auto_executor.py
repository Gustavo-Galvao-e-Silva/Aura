"""
Auto-Executor - Automatic payment execution for high-confidence decisions.

This background service monitors agent recommendations and automatically
executes payments when confidence is high (≥90%).
"""
import asyncio
from datetime import datetime
from typing import List, Dict
import httpx
from my_fastapi_app.app.state import get_current_state
from my_fastapi_app.app.settings import settings


# Confidence threshold for auto-execution
AUTO_EXECUTE_CONFIDENCE_THRESHOLD = 0.9  # 90%

# How often to check for auto-executable payments (15 minutes = 900 seconds)
AUTO_EXECUTOR_INTERVAL_SECONDS = 900


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


async def auto_executor_loop():
    """
    Background task that monitors agent decisions and auto-executes high-confidence payments.

    Runs every 15 minutes and checks for:
    - Decisions with pay=true
    - Market confidence ≥ 90%
    - Bills not yet paid

    When found, automatically executes the payment via settlement endpoint.
    """
    print(f"🤖 Auto-Executor: Starting (checking every {AUTO_EXECUTOR_INTERVAL_SECONDS}s)")
    print(f"   Confidence threshold: {AUTO_EXECUTE_CONFIDENCE_THRESHOLD:.0%}")

    while True:
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"\n[{timestamp}] 🤖 Auto-Executor: Checking for high-confidence payments...")

            # Get current agent state
            state = get_current_state()
            decisions = state.get("payment_decisions", [])

            if not decisions:
                print("   No payment decisions found in state")
                await asyncio.sleep(AUTO_EXECUTOR_INTERVAL_SECONDS)
                continue

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
                await asyncio.sleep(AUTO_EXECUTOR_INTERVAL_SECONDS)
                continue

            print(f"   🎯 Found {len(auto_executable)} high-confidence payment(s) to execute:")

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
                else:
                    error = result["error"]
                    # Check if error is "already paid" (non-critical)
                    if "already paid" in error.lower():
                        print(f"      ℹ️  Already paid (skipping)")
                    else:
                        print(f"      ❌ Failed: {error}")

            print(f"\n   Auto-execution cycle complete. Sleeping for {AUTO_EXECUTOR_INTERVAL_SECONDS}s...")

        except Exception as e:
            print(f"   ⚠️  Auto-Executor error: {e}")
            print("   Will retry on next cycle...")

        await asyncio.sleep(AUTO_EXECUTOR_INTERVAL_SECONDS)
