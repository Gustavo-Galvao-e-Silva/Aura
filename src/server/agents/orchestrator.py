from datetime import date
from sqlalchemy import select
from my_fastapi_app.app.db.session import AsyncSessionLocal
from db.models import Liability
from agents.state import AuraState

async def orchestrator_node(state: AuraState):
    """
    Role 4: The Master Orchestrator.
    Combines Market Intel, Route Facts, and DB Liabilities to make decisions.
    Determines 'Pay' vs 'Wait' for every liability and returns structured data.

    Now enhanced to consume the full MarketAnalysis structure with:
    - prediction (BULLISH/BEARISH/NEUTRAL)
    - confidence (0.0 to 1.0)
    - thesis (the "why")
    - risk_flags (specific concerns like election_volatility)
    """
    async with AsyncSessionLocal() as db:
        # 1. Fetch ALL unpaid liabilities (both actual and predicted)
        result = await db.execute(
            select(Liability).filter(Liability.is_paid == False)
        )
        unpaid = result.scalars().all()

        if not unpaid:
            print("🎖️ Orchestrator: No unpaid liabilities.")
            return {"selected_route": None, "payment_decisions": []}

        # 2. Get route data and market analysis
        routes = state.get("route_options", [])
        crebit_route = next((r for r in routes if r["name"] == "Crebit"), None)

        # NEW: Get the structured market analysis
        market_analysis = state.get("market_analysis", {})
        prediction = market_analysis.get("prediction", "NEUTRAL")
        confidence = market_analysis.get("confidence", 0.0)
        thesis = market_analysis.get("thesis", "No market analysis available.")
        risk_flags = market_analysis.get("risk_flags", [])

        # Fallback to legacy field if market_analysis is empty
        if not prediction or prediction == "NEUTRAL":
            prediction = state.get("market_prediction", "NEUTRAL")

        print(f"🎖️ Orchestrator: Market = {prediction} (confidence: {confidence:.0%})")
        print(f"   Risk Flags: {', '.join(risk_flags) if risk_flags else 'None'}")

        decisions_list = []
        top_alert = None

        for bill in unpaid:
            days_until_due = (bill.due_date - date.today()).days

            # --- ENHANCED DECISION LOGIC ---
            pay_now = False
            reason = "Market conditions are unclear or unfavorable. Waiting for better conditions."

            # Rule 1: URGENT bills (due in ≤3 days) always get paid
            if days_until_due <= 3:
                pay_now = True
                reason = f"URGENT: {bill.name} is due in {max(0, days_until_due)} days. Paying now to avoid penalties."

            # Rule 2: Check for high-risk flags that should block payment
            elif "fiscal_concerns" in risk_flags and confidence < 0.6:
                pay_now = False
                reason = f"Fiscal instability detected with low confidence ({confidence:.0%}). Waiting for clearer signals."

            elif "election_volatility" in risk_flags and days_until_due > 7:
                pay_now = False
                reason = "Election volatility detected. Delaying payment to observe market stabilization."

            elif "yield_curve_inversion" in risk_flags:
                pay_now = False
                reason = "US yield curve inverted (recession risk). Expect USD strength, waiting for better BRL rates."

            # Rule 3: BULLISH signal with high confidence → PAY
            elif prediction == "BULLISH" and confidence >= 0.7:
                pay_now = True
                reason = f"Strong BULLISH signal ({confidence:.0%} confidence). BRL is strong—locking in favorable rate now."

            # Rule 4: BULLISH signal with moderate confidence → PAY only if due soon
            elif prediction == "BULLISH" and 0.5 <= confidence < 0.7:
                if days_until_due <= 10:
                    pay_now = True
                    reason = f"Moderate BULLISH signal ({confidence:.0%}). Due in {days_until_due} days, paying to secure current rate."
                else:
                    pay_now = False
                    reason = f"Moderate BULLISH signal but low confidence ({confidence:.0%}). Waiting for stronger confirmation."

            # Rule 5: BEARISH signal → WAIT (unless urgent)
            elif prediction == "BEARISH":
                pay_now = False
                reason = f"BEARISH signal: BRL expected to weaken. Waiting for more favorable exchange rate (thesis: {thesis[:80]}...)."

            # Rule 6: NEUTRAL or low confidence → conservative (wait unless due soon)
            else:
                if days_until_due <= 5:
                    pay_now = True
                    reason = f"Neutral market outlook, but bill due in {days_until_due} days. Paying to avoid last-minute risk."
                else:
                    pay_now = False
                    reason = "Neutral market signal with mixed fundamentals. Monitoring conditions before acting."

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
                "is_predicted": bill.is_predicted,
                "pay": pay_now,
                "reason": reason,
                "cost_estimate_brl": cost_details.get("estimated_brl", 0.0),
                "market_confidence": confidence,  # NEW: Include confidence in decision
                "risk_flags": risk_flags  # NEW: Include risk context
            })

            # Prepare the string for the main selected_route alert (Top priority)
            # We prioritize actual bills over predicted ones for the top alert message
            if pay_now and not top_alert and not bill.is_predicted:
                top_alert = (
                    f"🚀 Aura Recommendation: {reason}\n"
                    f"Pay {bill.name} (${bill.amount:.2f}) via {crebit_route['name']} "
                    f"for R${cost_details.get('estimated_brl', 0.0):.2f}.\n"
                    f"Market Thesis: {thesis[:100]}..."
                )

        print(f"✅ Orchestrator: Processed {len(decisions_list)} bills")
        print(f"   Pay Now: {sum(1 for d in decisions_list if d['pay'])}, Wait: {sum(1 for d in decisions_list if not d['pay'])}")

        return {
            "payment_decisions": decisions_list,
            "selected_route": top_alert if top_alert else f"Aura suggests waiting. {thesis[:100]}..."
        }
