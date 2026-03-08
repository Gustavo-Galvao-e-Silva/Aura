from datetime import date
from my_fastapi_app.app.db.session import SessionLocal
from db.models import Liability
from agents.state import AuraState


def orchestrator_node(state: AuraState):
    """
    Role 4: The Master Orchestrator.
    Combines Market Intel, Route Facts, and DB Liabilities to make decisions.
    """
    db = SessionLocal()
    try:
        unpaid = db.query(Liability).filter(Liability.is_paid == False).all()

        if not unpaid:
            print("🎖️ Orchestrator: No unpaid liabilities. Standing down.")
            return {"selected_route": None}

        routes = state.get("route_options", [])
        crebit_route = next((r for r in routes if r["name"] == "Crebit"), None)

        market_signal = state.get("market_prediction")
        decisions = []

        for bill in unpaid:
            days_until_due = (bill.due_date - date.today()).days

            should_act = False
            reason = ""

            if market_signal == "BULLISH":
                should_act = True
                reason = "Market is BULLISH (BRL is strong). Buying now may save money."
            elif days_until_due <= 3:
                should_act = True
                reason = f"Deadline approach: {bill.name} is due in {days_until_due} days."

            if should_act and crebit_route:
                # scale provider output from reference_usd to actual bill amount
                reference_usd = crebit_route.get("reference_usd", 1000.0)
                fx_used = crebit_route.get("fx_used", 0.0)
                fee_usd = crebit_route.get("fee_usd", 0.0)
                eta_hours = crebit_route.get("eta_hours", "unknown")

                net_usd = max(bill.amount - fee_usd, 0)
                estimated_brl_received = net_usd * fx_used

                alert_msg = (
                    f"🚀 Aura Action: {reason}\n"
                    f"Bill: {bill.name} (${bill.amount:.2f})\n"
                    f"Rec: Use {crebit_route['name']} to save vs banks.\n"
                    f"Rate: {fx_used:.4f} BRL/USD\n"
                    f"Fee: ${fee_usd:.2f}\n"
                    f"Estimated BRL received: R${estimated_brl_received:.2f}\n"
                    f"ETA: {eta_hours}hr."
                )

                decisions.append(alert_msg)
                print(f"✅ Decision made for {bill.name}: {reason}")

        return {
            "selected_route": decisions[0] if decisions else "Wait for better market conditions."
        }
    finally:
        db.close()