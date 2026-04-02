from datetime import date
from sqlalchemy import select
from my_fastapi_app.app.db.session import AsyncSessionLocal
from db.models import Liability
from agents.state import AuraState
from pydantic import BaseModel, Field
from typing import List
from google import genai
from my_fastapi_app.app.settings import settings
import json


# ============================================================================
# Structured Output Schemas
# ============================================================================

class BillDecision(BaseModel):
    """Decision for a single bill."""
    liability_id: int = Field(description="Database ID of the liability")
    pay: bool = Field(description="True = pay now, False = wait")
    reason: str = Field(description="1-2 sentence explanation for this specific bill")


class OrchestratorOutput(BaseModel):
    """Structured output from the orchestrator LLM."""
    decisions: List[BillDecision] = Field(description="Pay/wait decision for each bill")
    selected_route_alert: str = Field(
        description="User-facing summary message (2-3 sentences) explaining the overall recommendation"
    )


# ============================================================================
# Orchestrator Node (LLM-Powered)
# ============================================================================

async def orchestrator_node(state: AuraState):
    """
    Role 4: The Master Orchestrator (LLM-Powered Decision Maker).

    Combines Market Intel, Route Facts, and DB Liabilities to make intelligent decisions.
    Uses Gemini with structured outputs to reason about each bill individually.

    This replaces the previous hardcoded if/elif rules with flexible LLM reasoning
    that can leverage the full nuance of the market thesis.
    """
    async with AsyncSessionLocal() as db:
        # 1. Fetch ALL unpaid liabilities
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

        market_analysis = state.get("market_analysis", {})
        prediction = market_analysis.get("prediction", "NEUTRAL")
        confidence = market_analysis.get("confidence", 0.0)
        thesis = market_analysis.get("thesis", "No market analysis available.")
        risk_flags = market_analysis.get("risk_flags", [])
        metrics = market_analysis.get("metrics", {})
        fetched_at = market_analysis.get("fetched_at", "unknown")

        print(f"🎖️ Orchestrator: Market = {prediction} (confidence: {confidence:.0%})")
        print(f"   Risk Flags: {', '.join(risk_flags[:3]) if risk_flags else 'None'}")
        print(f"   Data Fetched: {fetched_at}")

        # 3. Prepare bill data for LLM
        bills_summary = []
        for bill in unpaid:
            days_until_due = (bill.due_date - date.today()).days

            cost_estimate_brl = 0.0
            if crebit_route:
                fx = crebit_route.get("fx_used", 0.0)
                fee = crebit_route.get("fee_usd", 0.0)
                cost_estimate_brl = (bill.amount + fee) * fx

            bills_summary.append({
                "id": bill.id,
                "name": bill.name,
                "amount_usd": bill.amount,
                "days_until_due": days_until_due,
                "is_predicted": bill.is_predicted,
                "cost_estimate_brl": cost_estimate_brl
            })

        # 4. Build the LLM prompt
        prompt = f"""You are the Chief Financial Officer for Revellio, making intelligent payment decisions for international students.

# CONTEXT

## Market Analysis (fetched at {fetched_at})
**Prediction:** {prediction}
**Confidence:** {confidence:.0%}
**Thesis:** {thesis}
**Risk Flags:** {', '.join(risk_flags) if risk_flags else 'None'}

**Key Metrics:**
- Selic Rate: {metrics.get('selic_rate', 'N/A')}%
- Fed Funds Rate: {metrics.get('fed_funds_rate', 'N/A')}%
- Rate Differential: {metrics.get('rate_differential', 'N/A')}pp
- Commodity Sentiment: {metrics.get('commodity_sentiment', 'N/A')}
- Fiscal Health: {metrics.get('fiscal_health_score', 'N/A')}/10
- Political Stability: {metrics.get('political_stability_score', 'N/A')}/10

## Unpaid Bills (USD)
Total bills to decide: {len(bills_summary)}

{chr(10).join([f"- [{b['id']}] {b['name']}: ${b['amount_usd']:.2f} due in {b['days_until_due']} days (est. R${b['cost_estimate_brl']:.2f})" +
               (" [PREDICTED]" if b['is_predicted'] else "") for b in bills_summary])}

## Payment Route
Using **Crebit** with FX rate {crebit_route.get('fx_used', 0.0):.4f} BRL/USD

# YOUR TASK

For EACH bill above, decide: **PAY NOW** or **WAIT**

## Decision Framework:

### PAY NOW if:
1. **Urgent:** Due in ≤3 days (avoid late penalties)
2. **Strong BULLISH signal:** High confidence (≥0.7) that BRL is at peak strength → lock in rate now
3. **Moderate BULLISH + deadline:** Confidence ≥0.5 AND due in ≤10 days → secure current rate
4. **NEUTRAL + imminent:** Due in ≤5 days → pay to avoid last-minute risk

### WAIT if:
1. **BEARISH signal:** BRL expected to weaken → better rate coming (unless urgent)
2. **High-risk flags:** Election volatility, fiscal concerns, yield curve inversion → hold unless urgent
3. **Low confidence:** Confidence <0.5 AND not due soon → wait for clearer signals
4. **Predicted bill:** Not yet confirmed → wait unless very urgent

## Important Notes:
- URGENCY OVERRIDES EVERYTHING: Bills due in ≤3 days should almost always be paid
- Use the THESIS to understand WHY the market is moving, not just the prediction
- Consider SPECIFIC risk flags (e.g., "election_volatility" → delay if possible)
- For predicted bills, be more conservative (higher bar to pay)
- Market confidence affects your conviction, not the deadline math

## Output Format:
For each bill, provide:
1. `liability_id`: The bill ID number
2. `pay`: true (pay now) or false (wait)
3. `reason`: 1-2 sentences explaining your decision for THIS SPECIFIC bill (reference the thesis, confidence, and bill deadline)

Also provide:
- `selected_route_alert`: A 2-3 sentence summary for the user explaining your overall recommendation across all bills
"""

        # 5. Call Gemini with structured output
        try:
            gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)

            response = gemini_client.models.generate_content(
                model="gemini-3.1-flash-lite-preview",
                contents=[prompt],
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=OrchestratorOutput
                )
            )

            if response and response.text:
                llm_output = json.loads(response.text)

                # Convert LLM decisions to internal format
                decisions_list = []
                for decision in llm_output.get("decisions", []):
                    # Find the matching bill
                    bill = next((b for b in unpaid if b.id == decision["liability_id"]), None)
                    if not bill:
                        print(f"   ⚠️  LLM returned decision for unknown liability_id {decision['liability_id']}")
                        continue

                    # Calculate cost details
                    cost_details = {}
                    if crebit_route:
                        fx = crebit_route.get("fx_used", 0.0)
                        fee = crebit_route.get("fee_usd", 0.0)
                        cost_details = {
                            "fx_rate": fx,
                            "estimated_brl": (bill.amount + fee) * fx
                        }

                    decisions_list.append({
                        "liability_id": bill.id,
                        "username": bill.username,
                        "name": bill.name,
                        "amount_usd": bill.amount,
                        "is_predicted": bill.is_predicted,
                        "pay": decision["pay"],
                        "reason": decision["reason"],
                        "cost_estimate_brl": cost_details.get("estimated_brl", 0.0),
                        "market_confidence": confidence,
                        "risk_flags": risk_flags
                    })

                selected_route = llm_output.get("selected_route_alert", "Aura recommendation generated.")

                print(f"✅ Orchestrator (LLM): Processed {len(decisions_list)} bills")
                print(f"   Pay Now: {sum(1 for d in decisions_list if d['pay'])}, "
                      f"Wait: {sum(1 for d in decisions_list if not d['pay'])}")

                return {
                    "payment_decisions": decisions_list,
                    "selected_route": selected_route
                }

        except Exception as e:
            print(f"   ✗ LLM orchestrator failed: {e}")
            print(f"   ⚠️  Falling back to simple rule-based logic")

        # 6. Fallback: Simple rule-based logic (if LLM fails)
        decisions_list = []
        top_alert = None

        for bill in unpaid:
            days_until_due = (bill.due_date - date.today()).days

            # Ultra-simple fallback rules
            if days_until_due <= 3:
                pay_now = True
                reason = f"URGENT: Due in {days_until_due} days, paying to avoid penalties."
            elif prediction == "BULLISH" and confidence >= 0.7:
                pay_now = True
                reason = f"Strong BULLISH signal ({confidence:.0%}), locking in favorable rate."
            elif prediction == "BEARISH":
                pay_now = False
                reason = f"BEARISH signal: waiting for better rate. {thesis[:60]}..."
            elif days_until_due <= 7:
                pay_now = True
                reason = f"Due soon ({days_until_due} days), paying to secure current conditions."
            else:
                pay_now = False
                reason = "Monitoring market conditions before committing."

            cost_details = {}
            if crebit_route:
                fx = crebit_route.get("fx_used", 0.0)
                fee = crebit_route.get("fee_usd", 0.0)
                cost_details = {
                    "fx_rate": fx,
                    "estimated_brl": (bill.amount + fee) * fx
                }

            decisions_list.append({
                "liability_id": bill.id,
                "username": bill.username,
                "name": bill.name,
                "amount_usd": bill.amount,
                "is_predicted": bill.is_predicted,
                "pay": pay_now,
                "reason": reason,
                "cost_estimate_brl": cost_details.get("estimated_brl", 0.0),
                "market_confidence": confidence,
                "risk_flags": risk_flags
            })

            if pay_now and not top_alert and not bill.is_predicted:
                top_alert = f"🚀 Aura Recommendation: {reason} Pay {bill.name} (${bill.amount:.2f}) via Crebit for R${cost_details.get('estimated_brl', 0.0):.2f}."

        print(f"✅ Orchestrator (Fallback): Processed {len(decisions_list)} bills")

        return {
            "payment_decisions": decisions_list,
            "selected_route": top_alert if top_alert else f"Aura suggests waiting. {thesis[:100]}..."
        }
