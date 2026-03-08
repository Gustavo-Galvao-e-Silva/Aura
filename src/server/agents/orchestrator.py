from datetime import date
from my_fastapi_app.app.db.session import SessionLocal
from db.models import Liability
from agents.state import AuraState

def orchestrator_node(state: AuraState):
    """
    Role 4: The Master Orchestrator.
    Combines Market Intel, Route Facts, and DB Liabilities to make decisions.
    Determines 'Pay' vs 'Wait' for every liability and returns structured data.
    """
    db = SessionLocal()
    try:
        # 1. Fetch ALL unpaid actual liabilities
        unpaid = db.query(Liability).filter(
            Liability.is_paid == False, 
            Liability.is_predicted == False
        ).all()

        if not unpaid:
            print("🎖️ Orchestrator: No unpaid liabilities.")
            return {"selected_route": None, "payment_decisions": []}

        # 2. Get route data
        routes = state.get("route_options", [])
        crebit_route = next((r for r in routes if r["name"] == "Crebit"), None)
        market_signal = state.get("market_prediction")
        
        decisions_list = []
        top_alert = None

        for bill in unpaid:
            days_until_due = (bill.due_date - date.today()).days
            
            # --- STRUCTURED DECISION LOGIC ---
            pay_now = False
            reason = "Market is neutral/bearish and deadline is far. Waiting for better conditions."

            if market_signal == "BULLISH":
                pay_now = True
                reason = "Market is BULLISH (BRL is strong). Converting now locks in savings."
            elif days_until_due <= 3:
                pay_now = True
                reason = f"URGENT: {bill.name} is due in {max(0, days_until_due)} days. Pay now to avoid penalties."

            # Calculate the specific cost for this bill
            cost_details = {}
            if crebit_route:
                fx = crebit_route.get("fx_used", 0.0)
                fee = crebit_route.get("fee_usd", 0.0)
                cost_details = {
                    "fx_rate": fx,
                    "estimated_brl": (bill.amount + fee) * fx
                }

            # Add to structured JSON
            decisions_list.append({
                "liability_id": bill.id,
                "name": bill.name,
                "amount_usd": bill.amount,
                "pay": pay_now,
                "reason": reason,
                "cost_estimate_brl": cost_details.get("estimated_brl", 0.0)
            })

            # Prepare the string for the main selected_route alert (Top priority)
            if pay_now and not top_alert:
                top_alert = (
                    f"🚀 Aura Recommendation: {reason}\n"
                    f"Pay {bill.name} (${bill.amount:.2f}) via {crebit_route['name']} "
                    f"for R${cost_details.get('estimated_brl', 0.0):.2f}."
                )

        print(f"✅ Orchestrator processed {len(decisions_list)} bills.")

        return {
            "payment_decisions": decisions_list,
            "selected_route": top_alert if top_alert else "Aura suggests waiting for better market conditions."
        }
    except Exception as e:
        print(f"❌ Orchestrator Error: {e}")
        return {"payment_decisions": [], "selected_route": None}
    finally:
        db.close()
