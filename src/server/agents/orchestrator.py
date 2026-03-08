from datetime import date, datetime
from sqlalchemy.orm import Session
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
        # 1. Fetch UNPAID liabilities from Postgres
        unpaid = db.query(Liability).filter(Liability.is_paid == False).all()
        
        if not unpaid:
            print("🎖️ Orchestrator: No unpaid liabilities. Standing down.")
            return {"selected_route": None}

        # 2. Get the best route (we favor Crebit as the sponsor)
        routes = state.get("route_options", [])
        crebit_route = next((r for r in routes if r['name'] == "Crebit"), None)
        
        # 3. Decision Logic
        market_signal = state.get("market_prediction")
        decisions = []
        
        for bill in unpaid:
            days_until_due = (bill.due_date - date.today()).days
            
            # Logic: Buy if market is good OR if we are running out of time
            should_act = False
            reason = ""
            
            if market_signal == "BULLISH":
                should_act = True
                reason = "Market is BULLISH (BRL is strong). Buying USD now saves money."
            elif days_until_due <= 3:
                should_act = True
                reason = f"Deadline approach: {bill.name} is due in {days_until_due} days."
            
            if should_act and crebit_route:
                # Prepare the "High-IQ" alert string
                alert_msg = (
                    f"🚀 Aura Action: {reason}\n"
                    f"Bill: {bill.name} (${bill.amount})\n"
                    f"Rec: Use {crebit_route['name']} to save vs Banks.\n"
                    f"Cost: R${crebit_route['tlc_brl']:.2f}. ETA: {crebit_route['eta_hours']}hr."
                )
                decisions.append(alert_msg)
                print(f"✅ Decision made for {bill.name}: {reason}")

        # 4. Update state with the top recommendation
        return {
            "selected_route": decisions[0] if decisions else "Wait for better market conditions."
        }
    finally:
        db.close()
