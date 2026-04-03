"""
User Coordinator - Manages per-user orchestrator and auto-executor runs.

This node loops through all users with unpaid bills and runs the orchestrator
and auto-executor for each user separately to maintain privacy.

Flow:
  router (global) → user_coordinator → END
    └─ For each user:
         orchestrator (user-specific) → auto_executor (user-specific) → trust_engine (per-user audit)
"""
from typing import List, Dict
from sqlalchemy import select
from my_fastapi_app.app.db.session import AsyncSessionLocal
from db.models import Liability
from agents.state import AuraState
from agents.orchestrator import orchestrator_node
from agents.auto_executor import auto_executor_node, execute_payment
from agents.trust import trust_engine_node


async def get_users_with_unpaid_bills() -> List[str]:
    """
    Get list of unique usernames with unpaid bills.

    Returns:
        List of usernames with at least one unpaid, confirmed liability
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Liability.username).filter(
                Liability.is_paid == False,
                Liability.is_predicted == False
            ).distinct()
        )
        usernames = [row[0] for row in result.all()]
        return usernames


async def user_coordinator_node(state: AuraState):
    """
    Coordinator node: Runs orchestrator + auto-executor for each user.

    This ensures privacy - each user's bills are analyzed separately,
    but they all benefit from the same global market analysis and FX rates.

    SELF-CORRECTING: If contradictions detected by trust engine, aborts
    execution to prevent inconsistent behavior. Will retry on next heartbeat.

    Args:
        state: Current AuraState with market_analysis and route_options

    Returns:
        Updated state with all users' payment_decisions and auto_executor_results
    """
    print("👥 User Coordinator: Processing per-user decisions...")

    # Check if execution should be aborted due to contradictions
    abort_execution = state.get("abort_execution", False)
    abort_reason = state.get("abort_reason")

    if abort_execution:
        print(f"🛑 EXECUTION ABORTED BY TRUST ENGINE")
        print(f"   Reason: {abort_reason}")
        print(f"   Skipping all orchestration and execution this cycle.")
        print(f"   Next heartbeat (60s) will re-gather market data and retry.")
        return {
            "payment_decisions": [],
            "auto_executor_results": [],
            "execution_skipped": True,
            "skip_reason": abort_reason
        }

    # Get all users with unpaid bills
    users = await get_users_with_unpaid_bills()

    if not users:
        print("   No users with unpaid bills")
        return {
            "payment_decisions": [],
            "auto_executor_results": []
        }

    print(f"   Found {len(users)} user(s) with unpaid bills: {', '.join(users)}")

    all_decisions = []
    all_execution_results = []
    all_audit_hashes = []

    # Process each user separately
    for username in users:
        print(f"\n   📋 Processing user: @{username}")

        # Run orchestrator for this user
        user_state = {**state, "username": username}
        orchestrator_result = await orchestrator_node(user_state)

        user_decisions = orchestrator_result.get("payment_decisions", [])

        # Mark which decisions were executed before auditing
        execution_results = []

        # Run auto-executor for this user's decisions
        if user_decisions:
            # Filter for auto-executable decisions (pay=true, not predicted)
            auto_executable = [
                d for d in user_decisions
                if d.get("pay") is True and not d.get("is_predicted", False)
            ]

            if auto_executable:
                print(f"   🤖 Auto-Executor: Found {len(auto_executable)} payment(s) to execute for @{username}")

                for decision in auto_executable:
                    liability_id = decision.get("liability_id")
                    name = decision.get("name")
                    amount_usd = decision.get("amount_usd", 0.0)
                    confidence = decision.get("market_confidence", 0.0)
                    reason = decision.get("reason", "")

                    print(f"\n      ▶️  Executing: {name} (${amount_usd:.2f})")
                    print(f"         Confidence: {confidence:.0%}")
                    print(f"         Reason: {reason}")

                    result = await execute_payment(liability_id, username)

                    if result["success"]:
                        print(f"         ✅ Success! Transaction ID: {result['transaction_id']}")
                        execution_results.append({
                            "liability_id": liability_id,
                            "username": username,
                            "status": "executed",
                            "transaction_id": result["transaction_id"]
                        })
                        # Mark this decision as executed
                        decision["executed"] = True
                    else:
                        error = result["error"]
                        if "already paid" in error.lower():
                            print(f"         ℹ️  Already paid (skipping)")
                            execution_results.append({
                                "liability_id": liability_id,
                                "username": username,
                                "status": "already_paid",
                                "error": error
                            })
                        else:
                            print(f"         ❌ Failed: {error}")
                            execution_results.append({
                                "liability_id": liability_id,
                                "username": username,
                                "status": "failed",
                                "error": error
                            })

                all_execution_results.extend(execution_results)
            else:
                print(f"   ℹ️  No auto-executable payments for @{username}")

        # Create per-user audit trail
        # Build user-specific state for trust engine
        user_audit_state = {
            **state,
            "username": username,
            "payment_decisions": user_decisions,
        }

        # Run trust engine for this user only
        print(f"   🔐 Creating audit trail for @{username}...")
        trust_result = await trust_engine_node(user_audit_state)

        audit_hash = trust_result.get("audit_hash")
        if audit_hash:
            all_audit_hashes.append({
                "username": username,
                "audit_hash": audit_hash
            })
            print(f"   ✅ Audit created: {audit_hash[:16]}...")

        # Add to combined results
        all_decisions.extend(user_decisions)

    print(f"\n✅ User Coordinator: Processed {len(users)} user(s)")
    print(f"   Total decisions: {len(all_decisions)}")
    print(f"   Total executions: {len(all_execution_results)}")
    print(f"   Total audit entries: {len(all_audit_hashes)}")

    return {
        "payment_decisions": all_decisions,
        "auto_executor_results": all_execution_results,
        "audit_hashes": all_audit_hashes
    }
