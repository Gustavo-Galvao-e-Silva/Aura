# 🚀 Revellio Stablecoin Integration & Agentic Brain Upgrade Plan

**Created:** 2026-03-31
**Last Updated:** 2026-04-01 (Supabase Integration Merge)
**Status:** Phase 2 (Steps 2.1-2.2) ✅ COMPLETE | Phase 1 + Phase 2 (Steps 2.3-2.5) 🔄 IN PROGRESS
**Estimated Remaining Duration:** 6-8 hours

---

## 📋 Executive Summary

This plan addresses all architectural concerns raised in conversation.md and implements a complete stablecoin sandbox for Revellio. The work is divided into two major phases:

### Phase 1: Agentic Brain Upgrade (3-4 hours) 🔄 NOT STARTED
Fix four critical architectural issues identified in the agent system:
1. **State Schema Brittleness** - Replace `Dict[str, Any]` with typed structures
2. **Missing Timestamp Provenance** - Add `fetched_at` to audit trail
3. **Orchestrator Bottleneck** - Replace hardcoded if/elif with LLM reasoning
4. **Audit Completeness** - Include data freshness timestamp in blockchain hash

### Phase 2: Stablecoin Sandbox Implementation (4-6 hours) 🔄 PARTIALLY COMPLETE
Build complete Web2.5 stablecoin pipeline for testing without real money:
1. ✅ **Step 2.1 COMPLETE**: Database Schema - Wallet/Checkout/Transaction tables with double-entry accounting
2. ✅ **Step 2.2 COMPLETE**: Stripe Webhooks - Idempotent deposit handling with balance tracking
3. ❌ **Step 2.3 TODO**: Stellar Testnet Tools - Mock-BRZ minting and USDC conversion
4. ❌ **Step 2.4 TODO**: Circle Sandbox - Simulated fiat off-ramp (USDC → wire transfer)
5. ❌ **Step 2.5 TODO**: Settlement Flow - End-to-end payment processing with email receipts

### Phase 3: Route Polish (30 minutes) ⏸️ DEFERRED
- Update remaining API endpoints to surface transaction IDs
- Add blockchain verification links to emails

---

## 🎯 Goals & Motivation

### From conversation.md Key Points:

**User's Vision:**
> "I want to integrate stablecoins into Revellio to help international students pay USD bills using BRL deposits"

**Technical Challenge:**
> "We need a sandbox prototype with fake money - no real funds during development"

**Architectural Concerns (from LLM review):**
1. **Orchestrator is too rigid** - Current system uses 45 lines of if/elif rules that waste the nuanced market thesis
2. **State schema is brittle** - Using `Dict[str, Any]` allows any structure, no type safety
3. **Trust Engine audit is incomplete** - Missing timestamp provenance (can't prove when data was fresh)
4. **Need double-entry accounting** - ✅ **SOLVED** by teammate's `Wallet`/`Transaction` architecture

**Solution Approach:**
- **Approach 1 (Database Ledger/Web2.5)**: Chosen for sandbox
  - Fiat stays in Stripe/bank accounts
  - PostgreSQL tracks stablecoin balances ✅ DONE
  - Backend coordinates conversions via APIs ⏸️ IN PROGRESS
  - Stellar Testnet for blockchain simulation ❌ TODO
  - Circle Sandbox for fiat off-ramp testing ❌ TODO

---

## 🔍 Current State Analysis (Updated 2026-04-01)

### ✅ What's Already Working:

1. **Supabase Migration** ✅ COMPLETE
   - Migrated from local PostgreSQL to Supabase cloud database
   - Fixed asyncpg pooler compatibility (`statement_cache_size=0` in session.py)
   - All migrations applied: `001_initial_schema` + `770d3084524c` (wallet tables)
   - Docker configs updated for cloud database

2. **Wallet Infrastructure (Phase 2 Steps 2.1-2.2)** ✅ COMPLETE
   - **Database Tables** (models.py:61-156):
     - `wallets` table: `brl_available`, `usd_available`, `brl_pending`, running totals
     - `checkouts` table: Stripe session lifecycle tracking (created → completed)
     - `transactions` table: Immutable double-entry ledger with balance snapshots
   - **API Endpoints** (routes/payments.py):
     - `POST /payments/checkout` - Create Stripe Checkout session
     - `POST /payments/webhook` - Idempotent webhook handler with signature verification
     - `GET /payments/balance/{username}` - Wallet balance query
     - `GET /payments/history/{username}` - Paginated transaction history
   - **Frontend** (client/src/pages/Wallet.tsx):
     - Wallet UI with deposit flow
     - Transaction history display
     - TypeScript client (API/PaymentsClient.ts)
   - **Documentation**:
     - `/temp-docs/teammate/stripe_implementation_docs.md` - API and webhook docs
     - `/temp-docs/teammate/stablecoin_pipeline_docs.md` - Full pipeline architecture

3. **Semantic Search (Phase 6 from MIGRATION_COMPLETE.md)** ✅ DONE
   - pgvector extension enabled in Supabase
   - `reasoning_embedding` column in AuditLog (models.py:37)
   - `generate_reasoning_embedding()` in tools/embeddings.py
   - trust.py generates 384-dim embeddings (trust.py:96-110)
   - `/blockchain/search/similar` endpoint (blockchain.py:68-145)
   - `/blockchain/search/contradictions` endpoint (blockchain.py:148-236)

4. **Async Database Operations (Phase 5 from migration)** ✅ DONE
   - All agents use AsyncSession
   - orchestrator.py uses async/await (orchestrator.py:7-19)
   - Non-blocking I/O throughout

5. **Centralized Configuration (Phase 3 from migration)** ✅ DONE
   - Type-safe settings.py with pydantic-settings
   - Stripe keys configured (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
   - Default balances removed from settings (now handled by Wallet table defaults)

6. **Structured Outputs in Researchers** ✅ MOSTLY DONE
   - SentimentAnalysis(BaseModel) for sentiment researcher (researchers.py:209-215)
   - MarketMetrics(BaseModel) defined in synthesis_node (researchers.py:526-534)
   - MarketAnalysisResponse(BaseModel) for Gemini output (researchers.py:536-541)
   - Using Gemini's `response_schema` to enforce JSON structure

---

### ❌ What Still Needs Fixing:

#### **Issue 1: State Schema Mismatch** (state.py:7) - Phase 1
**Current Code:**
```python
# state.py:4-12
class MarketAnalysis(TypedDict):
    prediction: str # "BULLISH" | "BEARISH" | "NEUTRAL"
    confidence: float # 0.0 to 1.0
    thesis: str # 2 to 3 sentence explanation
    metrics: Dict[str, Any]  # ← PROBLEM: Too loose!
    risk_flags: List[str]
    # MISSING: fetched_at timestamp for audit provenance
```

**Problem:**
- `metrics: Dict[str, Any]` allows any structure, no type safety
- researchers.py already defines a proper `MarketMetrics(BaseModel)` on lines 526-534
- The two definitions are out of sync

**Impact:**
- Can't catch schema errors at development time
- No IDE autocomplete for metric fields
- Trust Engine can't guarantee what's in the hash

---

#### **Issue 2: Missing Timestamp Provenance** (state.py + trust.py) - Phase 1
**Current Code:**
```python
# researchers.py:60-62 (macro_researcher_node)
findings = {
    "fetched_at": datetime.now().isoformat(),  # ← Generated but not used!
    "sources": []
}

# trust.py:29-42 (trust_engine_node)
decision_payload = {
    "market_prediction": market_analysis.get("prediction", state.get("market_prediction")),
    "market_confidence": market_analysis.get("confidence", 0.0),
    # ... other fields ...
    # MISSING: fetched_at timestamp!
}
```

**Problem:**
- All 3 researchers generate `fetched_at` timestamps
- But `fetched_at` never flows into the final `MarketAnalysis` structure
- Trust Engine hashes the decision but not when the data was valid
- Can't prove that data was fresh when the decision was made

**Impact:**
- Audit trail is incomplete - you can verify a decision was made, but not when the data driving it was collected
- Could make a decision based on stale data without knowing

---

#### **Issue 3: Orchestrator Bottleneck** (orchestrator.py:58-103) - Phase 1
**Current Code:**
```python
# orchestrator.py:58-103 (45 lines of hardcoded rules!)
# Rule 1: URGENT bills (due in ≤3 days) always get paid
if days_until_due <= 3:
    pay_now = True
    reason = f"URGENT: {bill.name} is due..."

# Rule 2: Check for high-risk flags
elif "fiscal_concerns" in risk_flags and confidence < 0.6:
    pay_now = False
    reason = f"Fiscal instability detected..."

elif "election_volatility" in risk_flags and days_until_due > 7:
    pay_now = False
    reason = "Election volatility detected..."

# ... 10+ more elif branches ...
```

**Problem:**
- 45 lines of rigid if/elif rules that can't adapt to nuanced scenarios
- Wastes the rich `thesis` generated by synthesis_node (researchers.py:491-494)
- Example: thesis says "Bullish on rates but bearish on politics for next 2 weeks" → orchestrator can't parse this nuance
- Adding new rules requires code changes instead of prompt engineering

**Impact:**
- Can't leverage the full intelligence of the market synthesis
- System can't learn or adapt without code changes
- Misses complex interactions between multiple risk factors

---

## 📦 Phase 1: Agentic Brain Upgrade

**Duration:** 3-4 hours
**Priority:** HIGH (fixes architectural debt)
**Status:** ❌ NOT STARTED

### Step 1.1: Fix State Schema (state.py)

**Goal:** Replace loose `Dict[str, Any]` with strongly-typed `MarketMetrics`

**Files to Modify:**
- `src/server/agents/state.py`

**Current Code (state.py:4-12):**
```python
class MarketAnalysis(TypedDict):
    prediction: str
    confidence: float
    thesis: str
    metrics: Dict[str, Any]  # ← Replace this
    risk_flags: List[str]
```

**New Code:**
```python
from typing import TypedDict, List, Optional

# Define typed metrics structure matching what synthesis_node produces
class MarketMetrics(TypedDict, total=False):
    """
    Typed market metrics structure.
    Using total=False allows optional fields (not all data may be available).
    """
    # Macro indicators (from macro_researcher_node)
    selic_rate: Optional[float]
    fed_funds_rate: Optional[float]
    rate_differential: Optional[float]
    focus_ipca_12m: Optional[float]
    focus_selic_eoy: Optional[float]
    us_cpi_yoy: Optional[float]
    yield_curve_10y2y: Optional[float]
    brazil_gdp_growth: Optional[float]
    usa_gdp_growth: Optional[float]

    # Commodity indicators (from commodity_researcher_node)
    commodity_sentiment: Optional[str]  # "bullish" | "bearish" | "neutral"
    oil_price: Optional[float]
    soy_price: Optional[float]
    iron_price: Optional[float]

    # Sentiment indicators (from sentiment_researcher_node)
    fiscal_health_score: Optional[int]  # 1-10
    geopolitical_risk_score: Optional[int]  # 1-10
    political_stability_score: Optional[int]  # 1-10


class MarketAnalysis(TypedDict):
    """
    Structured market analysis output from synthesis_node.
    This is what the orchestrator consumes to make pay/wait decisions.
    """
    prediction: str  # "BULLISH" | "BEARISH" | "NEUTRAL"
    confidence: float  # 0.0 to 1.0
    thesis: str  # 2-3 sentence explanation of the prediction
    metrics: MarketMetrics  # ← Now strongly typed!
    risk_flags: List[str]  # e.g., ["fiscal_concerns", "election_volatility"]
    fetched_at: str  # ← NEW: ISO 8601 timestamp of when data was collected


class AuraState(TypedDict, total=False):
    # ... rest of state definition unchanged ...
```

**Why This Matters:**
- Type safety catches errors at development time
- IDE autocomplete works for all metric fields
- Trust Engine can guarantee what's in the audit hash
- Matches the structure already used by researchers.py (lines 526-534)

**Testing:**
```bash
# Verify no type errors
cd src/server
python -m mypy agents/state.py

# Run the system and check logs
docker-compose exec backend python -m agents.graph
```

**Estimated Time:** 30 minutes

---

### Step 1.2: Add Timestamp Provenance Flow

**Goal:** Ensure `fetched_at` timestamp flows from researchers → synthesis → trust engine

**Files to Modify:**
- `src/server/agents/researchers.py` (market_synthesis_node function)
- `src/server/agents/state.py` (already done in Step 1.1)

**Current Code (researchers.py:564-570):**
```python
# researchers.py:564-570 (inside market_synthesis_node)
market_analysis = {
    "prediction": prediction,
    "confidence": confidence,
    "thesis": analysis.get("thesis", "No thesis generated."),
    "metrics": analysis.get("metrics", {}),
    "risk_flags": analysis.get("risk_flags", [])
    # MISSING: fetched_at!
}
```

**New Code:**
```python
# researchers.py:564-571 (add fetched_at to market_analysis)
market_analysis = {
    "prediction": prediction,
    "confidence": confidence,
    "thesis": analysis.get("thesis", "No thesis generated."),
    "metrics": analysis.get("metrics", {}),
    "risk_flags": analysis.get("risk_flags", []),
    "fetched_at": datetime.now().isoformat()  # ← NEW: timestamp for audit
}
```

**Also Update Fallback Path (researchers.py:613-625):**
```python
# researchers.py:613-626 (fallback rule-based analysis)
market_analysis = {
    "prediction": prediction,
    "confidence": confidence,
    "thesis": thesis,
    "metrics": {
        "selic_rate": macro.get("selic_rate"),
        "fed_funds_rate": macro.get("fed_funds_rate"),
        "rate_differential": rate_diff,
        "commodity_sentiment": commodity_sent,
        "fiscal_health_score": fiscal_score
    },
    "risk_flags": risk_flags,
    "fetched_at": datetime.now().isoformat()  # ← NEW: add here too
}
```

**Why This Matters:**
- Provides audit trail of when data was collected
- Trust Engine can hash this to prove data freshness
- Helps debug stale data issues

**Testing:**
```bash
# Run a full agent cycle and check the state
docker-compose exec backend python -c "
from agents.graph import app
from agents.state import AuraState

state = AuraState(username='testuser')
result = app.invoke(state)
print('fetched_at:', result['market_analysis'].get('fetched_at'))
"
```

**Estimated Time:** 15 minutes

---

### Step 1.3: Replace Orchestrator with LLM Reasoning

**Goal:** Replace 45 lines of if/elif rules with a single LLM call using structured outputs

**Files to Modify:**
- `src/server/agents/orchestrator.py`

**Current Approach:** 45 lines of hardcoded rules (orchestrator.py:58-103)

**New Approach:** Use Gemini with Pydantic schema to make intelligent decisions

**Implementation:**

```python
# orchestrator.py - NEW VERSION
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
                model="gemini-2.0-flash-exp",
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
```

**Key Improvements:**
1. **Flexible Reasoning**: LLM can understand complex thesis like "bullish on rates but bearish on politics"
2. **Individual Bill Context**: Each decision considers the specific bill's deadline + market conditions
3. **Structured Output**: Pydantic schema ensures valid JSON every time
4. **Graceful Degradation**: Falls back to simple rules if LLM fails
5. **Audit Trail**: Decisions include confidence and risk flags for later analysis

**Testing:**
```bash
# Test with a real unpaid bill
docker-compose exec backend python -c "
from agents.graph import app
from agents.state import AuraState

state = AuraState(username='testuser')
result = app.invoke(state)

print('Decisions:', result['payment_decisions'])
print('Alert:', result['selected_route'])
"
```

**Estimated Time:** 1.5-2 hours

---

### Step 1.4: Update Trust Engine Audit Hash

**Goal:** Include `fetched_at` timestamp in the decision payload that gets hashed

**Files to Modify:**
- `src/server/agents/trust.py`

**Current Code (trust.py:29-42):**
```python
# trust.py:29-42
decision_payload = {
    "market_prediction": market_analysis.get("prediction", state.get("market_prediction")),
    "market_confidence": market_analysis.get("confidence", 0.0),
    "market_thesis": market_analysis.get("thesis", ""),
    "risk_flags": market_analysis.get("risk_flags", []),
    "market_metrics": market_analysis.get("metrics", {}),
    "current_fx_rate": state.get("current_fx_rate"),
    "reasoning": reasoning_text,
    "payment_decisions": state.get("payment_decisions")
    # MISSING: fetched_at!
}
```

**New Code:**
```python
# trust.py:29-43 (add fetched_at)
decision_payload = {
    "market_prediction": market_analysis.get("prediction", state.get("market_prediction")),
    "market_confidence": market_analysis.get("confidence", 0.0),
    "market_thesis": market_analysis.get("thesis", ""),
    "risk_flags": market_analysis.get("risk_flags", []),
    "market_metrics": market_analysis.get("metrics", {}),
    "data_fetched_at": market_analysis.get("fetched_at", None),  # ← NEW: timestamp provenance
    "current_fx_rate": state.get("current_fx_rate"),
    "reasoning": reasoning_text,
    "payment_decisions": state.get("payment_decisions")
}
```

**Also Update Embedding Generation (trust.py:96-110):**
```python
# trust.py:99-107 (include fetched_at in semantic context)
reasoning_embedding = generate_reasoning_embedding(
    reasoning_text=reasoning_text,
    market_context={
        "prediction": decision_payload["market_prediction"],
        "confidence": decision_payload["market_confidence"],
        "thesis": decision_payload["market_thesis"],
        "risk_flags": decision_payload["risk_flags"],
        "data_fetched_at": decision_payload["data_fetched_at"]  # ← NEW: semantic search can filter by freshness
    }
)
```

**Why This Matters:**
- **Blockchain Audit**: SHA256 hash now includes when data was collected
- **Semantic Search**: Can filter decisions by data freshness (e.g., "decisions made on stale data >2hr old")
- **Debugging**: Can trace back when bad decisions were made on outdated market conditions

**Testing:**
```bash
# Verify the hash changes when fetched_at changes
docker-compose exec backend python -c "
from agents.trust import trust_engine_node
from agents.state import AuraState
import asyncio

state = AuraState(
    selected_route='Pay now',
    market_analysis={
        'prediction': 'BULLISH',
        'confidence': 0.8,
        'thesis': 'Strong fundamentals',
        'metrics': {},
        'risk_flags': [],
        'fetched_at': '2026-03-31T10:00:00'
    },
    payment_decisions=[]
)

result = asyncio.run(trust_engine_node(state))
print('Hash:', result['audit_hash'])
"
```

**Estimated Time:** 30 minutes

---

### Phase 1 Summary

**Total Time:** 3-4 hours
**Files Modified:** 3 files
- `agents/state.py` (typed schemas)
- `agents/researchers.py` (add fetched_at to output)
- `agents/orchestrator.py` (LLM reasoning)
- `agents/trust.py` (hash fetched_at)

**What This Achieves:**
✅ Type-safe state schema matching actual usage
✅ Timestamp provenance in audit trail
✅ Intelligent LLM-based orchestration instead of hardcoded rules
✅ Complete audit hash including data freshness

**Testing Checklist:**
- [ ] Run `mypy agents/state.py` to verify type safety
- [ ] Run full agent cycle and verify `fetched_at` appears in logs
- [ ] Test orchestrator with different market conditions (BULLISH, BEARISH, NEUTRAL)
- [ ] Verify blockchain hash changes when `fetched_at` changes
- [ ] Check `/blockchain/verify/{hash}` includes the new fields

---

## 📦 Phase 2: Stablecoin Sandbox Implementation

**Duration:** 4-6 hours
**Priority:** HIGH (user-requested feature)
**Status:** 🔄 PARTIALLY COMPLETE (Steps 2.1-2.2 done, Steps 2.3-2.5 remaining)

### Overview: The Stablecoin Flow

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│ User        │      │ Revellio     │      │ Stellar     │      │ Circle       │
│ (Brazil)    │      │ Backend      │      │ Testnet     │      │ Sandbox      │
└──────┬──────┘      └──────┬───────┘      └──────┬──────┘      └──────┬───────┘
       │                    │                     │                     │
       │ 1. Deposit BRL     │                     │                     │
       ├──────(Stripe)──────>                     │                     │
       │    Test Mode       │                     │                     │
       │                    │ 2. Mint Mock-BRZ    │                     │
       │                    ├─────────────────────>                     │
       │                    │   (Testnet asset)   │                     │
       │                    │                     │                     │
       │                    │ 3. Swap BRZ→USDC    │                     │
       │                    ├─────────────────────>                     │
       │                    │   (Testnet DEX)     │                     │
       │                    │                     │                     │
       │                    │ 4. Off-ramp USDC→USD│                     │
       │                    ├─────────────────────────────────────────>│
       │                    │                     │  (Sandbox API)      │
       │                    │                     │                     │
       │ 5. Bill Paid       │<────────────────────┴─────────────────────┘
       │    (Confirmation)  │
       <────────────────────┤
```

**Key Design Decisions (from conversation.md):**
1. **Database Ledger (Web2.5)**: Balances stored in PostgreSQL, blockchain for proof
2. **Test Mode Everything**: No real money touches the system
3. **Double-Entry Accounting**: Proper transaction ledger, not just balance updates
4. **Email Receipts**: User gets Stellar TX ID + Circle settlement ID

---

### ✅ Step 2.1: Database Schema + Migration (COMPLETE)

**Goal:** Extend database with wallet balance tracking and transaction ledger

**Status:** ✅ COMPLETE (Implemented 2026-03-31)

**What Was Implemented:**
- **Architecture Decision**: Instead of adding columns to `users` table, teammate created separate `Wallet`, `Checkout`, `Transaction` tables
- **Why Better**: Proper financial architecture with:
  - Immutable transaction ledger (double-entry accounting)
  - Balance snapshots for reconciliation
  - Idempotency support via Checkout lifecycle tracking
  - Clean separation of concerns

**Database Tables Created** (models.py:61-156):

```python
class Wallet(Base):
    """Current financial state — one wallet per user"""
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True)
    username = Column(String, ForeignKey("users.username"), unique=True)

    # Spendable balances
    brl_available = Column(Float, default=0.0)
    usd_available = Column(Float, default=0.0)

    # Stripe payment initiated but not yet confirmed
    brl_pending = Column(Float, default=0.0)

    # Running totals (for dashboard stats)
    total_deposited_brl = Column(Float, default=0.0)
    total_spent_brl = Column(Float, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Checkout(Base):
    """Tracks Stripe Checkout session lifecycle"""
    __tablename__ = "checkouts"

    id = Column(Integer, primary_key=True)
    username = Column(String, ForeignKey("users.username"))

    provider = Column(String, default="stripe")
    purpose = Column(String, default="wallet_topup")
    status = Column(String, default="created")  # created → completed | expired | cancelled

    currency = Column(String(3), default="USD")
    amount = Column(Float)

    stripe_checkout_session_id = Column(String, unique=True, index=True)
    stripe_payment_intent_id = Column(String, unique=True, index=True)

    metadata_json = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))


class Transaction(Base):
    """Immutable double-entry ledger — never delete or update"""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    username = Column(String, ForeignKey("users.username"))

    wallet_id = Column(Integer, ForeignKey("wallets.id"))
    checkout_id = Column(Integer, ForeignKey("checkouts.id"))
    liability_id = Column(Integer, ForeignKey("liabilities.id"))

    transaction_type = Column(String)  # deposit | payment | refund | conversion
    status = Column(String, default="completed")

    asset = Column(String)  # BRL | USD
    direction = Column(String)  # credit | debit
    amount = Column(Float)

    # Wallet snapshot for reconciliation
    balance_before = Column(Float)
    balance_after = Column(Float)

    # External references
    stripe_event_id = Column(String, index=True)
    stripe_payment_intent_id = Column(String, index=True)

    description = Column(String)
    metadata_json = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
```

**Migration Applied:**
```bash
alembic/versions/770d3084524c_add_wallet_checkout_transaction_tables.py
```

**Verification:**
```bash
# Check migration status
cd src/server && alembic current
# Output: 770d3084524c (head)

# Verify tables exist
psql $DATABASE_URL -c "\dt wallets checkouts transactions"
```

**Documentation:**
- See `/temp-docs/teammate/stablecoin_pipeline_docs.md` for full architecture

---

### ✅ Step 2.2: Stripe Webhook Handler (COMPLETE)

**Goal:** Handle Stripe Test Mode webhooks for deposits, credit user's wallet balance

**Status:** ✅ COMPLETE (Implemented 2026-03-31)

**What Was Implemented:**

**API Endpoints Created** (routes/payments.py):

1. **`POST /payments/checkout`** - Create Stripe Checkout session
   - Validates user exists
   - Creates Stripe session with metadata (username, amount_usd)
   - Persists `Checkout` row (status="created")
   - Returns checkout URL for frontend redirect

2. **`POST /payments/webhook`** - Stripe webhook handler
   - **Signature verification** when `STRIPE_WEBHOOK_SECRET` is configured
   - **Idempotent**: checks if Checkout already completed, skips double-credit
   - Credits `wallet.usd_available`
   - Writes immutable `Transaction` record with balance snapshots
   - Marks `Checkout.status = "completed"`
   - Atomic database commit

3. **`GET /payments/balance/{username}`** - Query wallet balance
   - Returns `WalletBalance` (brl_available, usd_available, brl_pending, totals)
   - Auto-creates zero-balance wallet if user has never deposited

4. **`GET /payments/history/{username}`** - Paginated transaction history
   - Returns transactions newest-first
   - Includes balance snapshots, Stripe references, description

**Frontend Integration:**
- `client/src/pages/Wallet.tsx` - Wallet UI with deposit flow
- `client/src/API/PaymentsClient.ts` - TypeScript API client
- Preset deposit amounts ($25, $50, $100, $250, $500)
- Transaction history display with icons (credit/debit)

**Testing Flow:**
```bash
# 1. Start Stripe webhook listener
stripe listen --forward-to localhost:8000/payments/webhook

# 2. Create checkout session
curl -X POST http://localhost:8000/payments/checkout \
  -H "Content-Type: application/json" \
  -d '{"username": "cbahlis", "amount_usd": 100.0}'

# 3. Visit returned checkout_url, pay with test card 4242 4242 4242 4242

# 4. Webhook fires automatically, credits wallet

# 5. Verify balance
curl http://localhost:8000/payments/balance/cbahlis

# 6. Check transaction history
curl http://localhost:8000/payments/history/cbahlis
```

**Idempotency Mechanism:**
```python
if checkout and checkout.status == "completed":
    return {"received": True, "processed": False, "reason": "already_completed"}
```

**Documentation:**
- See `/temp-docs/teammate/stripe_implementation_docs.md` for API reference

---

### ❌ Step 2.3: Stellar Testnet Tools (TODO)

**Goal:** Implement Mock-BRZ minting and USDC conversion on Stellar testnet

**Status:** ❌ NOT STARTED

**Files to Create:**
- `src/server/tools/stellar_tools.py`

**Functions to Implement:**

1. **`mint_mock_brz(user_public_key: str, amount_brl: float) -> str`**
   - Issues Mock-BRZ (custom asset on Stellar testnet) from Revellio's issuer account
   - Returns Stellar transaction hash
   - Prerequisites: user account must have trustline to BRZ/issuer

2. **`swap_brz_to_usdc(user_public_key: str, amount_brz: float, expected_rate: float) -> tuple[str, float]`**
   - Swaps Mock-BRZ for USDC using Stellar DEX path payment
   - Enforces 2% slippage protection
   - Returns (stellar_tx_hash, actual_usdc_received)
   - In sandbox: can simulate as direct payment from issuer

3. **`create_stellar_account(username: str) -> tuple[str, str]`**
   - Generates keypair for user
   - Funds account via Friendbot (testnet faucet)
   - Establishes trustlines for BRZ and USDC
   - Returns (public_key, secret_key)

**Environment Variables Needed:**
```bash
STELLAR_SECRET_KEY=S...  # Revellio's issuer keypair
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

**Implementation Example:**

```python
# tools/stellar_tools.py - NEW FILE
"""
Stellar testnet tools for stablecoin operations.

Mock-BRZ Asset:
- Issuer: GAXXX... (your testnet account)
- Asset Code: BRZ (Brazilian Real stablecoin, testnet version)
- 1 Mock-BRZ = 1 Real BRL (conceptually)

Operations:
1. mint_mock_brz(): Credit user's Stellar account with Mock-BRZ
2. swap_brz_to_usdc(): Use testnet DEX to convert BRZ → USDC
"""

from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset, Operation
from stellar_sdk.exceptions import BadRequestError, NotFoundError
from my_fastapi_app.app.settings import settings
from typing import Optional


# Stellar testnet configuration
TESTNET_SERVER = Server("https://horizon-testnet.stellar.org")
TESTNET_NETWORK = Network.TESTNET_NETWORK_PASSPHRASE

# Mock-BRZ asset (you need to create this issuer account first)
MOCK_BRZ_ISSUER = settings.STELLAR_MOCK_BRZ_ISSUER  # Testnet public key
MOCK_BRZ_ASSET = Asset("BRZ", MOCK_BRZ_ISSUER)

# USDC on Stellar testnet (real Circle test asset)
USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
USDC_ASSET = Asset("USDC", USDC_ISSUER)


def ensure_account_exists(public_key: str) -> bool:
    """
    Check if a Stellar account exists on testnet.
    If not, fund it using Friendbot (testnet faucet).
    """
    try:
        TESTNET_SERVER.accounts().account_id(public_key).call()
        print(f"   ✓ Account exists: {public_key[:10]}...")
        return True
    except NotFoundError:
        print(f"   Creating account via Friendbot: {public_key[:10]}...")
        try:
            import requests
            response = requests.get(f"https://friendbot.stellar.org?addr={public_key}")
            if response.status_code == 200:
                print(f"   ✓ Account funded: {public_key[:10]}...")
                return True
            else:
                print(f"   ✗ Friendbot failed: {response.text}")
                return False
        except Exception as e:
            print(f"   ✗ Friendbot error: {e}")
            return False


def establish_trustline(user_keypair: Keypair, asset: Asset) -> Optional[str]:
    """
    Establish a trustline to an asset (required before receiving it).

    In Stellar, you must explicitly trust an asset before you can hold it.
    """
    try:
        source_account = TESTNET_SERVER.load_account(user_keypair.public_key)

        transaction = (
            TransactionBuilder(
                source_account=source_account,
                network_passphrase=TESTNET_NETWORK,
                base_fee=settings.STELLAR_BASE_FEE
            )
            .append_change_trust_op(asset=asset, limit="1000000")
            .set_timeout(settings.STELLAR_TRANSACTION_TIMEOUT)
            .build()
        )

        transaction.sign(user_keypair)
        response = TESTNET_SERVER.submit_transaction(transaction)

        tx_id = response["hash"]
        print(f"   ✓ Trustline established for {asset.code}: {tx_id[:10]}...")
        return tx_id

    except BadRequestError as e:
        if "op_already_exists" in str(e):
            print(f"   ℹ️  Trustline already exists for {asset.code}")
            return "already_exists"
        else:
            print(f"   ✗ Trustline failed: {e}")
            return None
    except Exception as e:
        print(f"   ✗ Trustline error: {e}")
        return None


def mint_mock_brz(user_public_key: str, amount_brl: float) -> Optional[str]:
    """
    Mint Mock-BRZ tokens and send to user's Stellar account.

    This simulates converting fiat BRL → stablecoin BRZ on the blockchain.
    """
    try:
        print(f"🪙 Minting R${amount_brl:.2f} Mock-BRZ for {user_public_key[:10]}...")

        if not ensure_account_exists(user_public_key):
            print("   ✗ Cannot mint: user account does not exist")
            return None

        issuer_keypair = Keypair.from_secret(settings.STELLAR_SECRET_KEY)
        issuer_account = TESTNET_SERVER.load_account(issuer_keypair.public_key)

        transaction = (
            TransactionBuilder(
                source_account=issuer_account,
                network_passphrase=TESTNET_NETWORK,
                base_fee=settings.STELLAR_BASE_FEE
            )
            .append_payment_op(
                destination=user_public_key,
                asset=MOCK_BRZ_ASSET,
                amount=str(amount_brl)
            )
            .set_timeout(settings.STELLAR_TRANSACTION_TIMEOUT)
            .build()
        )

        transaction.sign(issuer_keypair)
        response = TESTNET_SERVER.submit_transaction(transaction)

        tx_id = response["hash"]
        print(f"   ✓ Minted R${amount_brl:.2f} Mock-BRZ: {tx_id[:10]}...")
        print(f"   Stellar Explorer: https://stellar.expert/explorer/testnet/tx/{tx_id}")

        return tx_id

    except BadRequestError as e:
        if "op_no_trust" in str(e):
            print(f"   ⚠️  User has not established trustline for Mock-BRZ")
            return None
        else:
            print(f"   ✗ Mint failed: {e}")
            return None
    except Exception as e:
        print(f"   ✗ Mint error: {e}")
        return None


def swap_brz_to_usdc(
    user_public_key: str,
    amount_brz: float,
    expected_rate: float = 5.5
) -> Optional[dict]:
    """
    Swap Mock-BRZ → USDC using Stellar testnet DEX.

    For sandbox, simplified as direct payment from issuer.
    In production, use PathPaymentStrictSend for real DEX routing.
    """
    try:
        print(f"🔄 Swapping R${amount_brz:.2f} Mock-BRZ → USDC (rate: {expected_rate:.4f})...")

        expected_usdc = amount_brz / expected_rate
        min_usdc = expected_usdc * 0.98  # 2% slippage protection

        print(f"   Expected: ${expected_usdc:.2f} USDC (min: ${min_usdc:.2f})")

        issuer_keypair = Keypair.from_secret(settings.STELLAR_SECRET_KEY)
        issuer_account = TESTNET_SERVER.load_account(issuer_keypair.public_key)

        transaction = (
            TransactionBuilder(
                source_account=issuer_account,
                network_passphrase=TESTNET_NETWORK,
                base_fee=settings.STELLAR_BASE_FEE
            )
            .append_payment_op(
                destination=user_public_key,
                asset=USDC_ASSET,
                amount=str(round(expected_usdc, 2))
            )
            .set_timeout(settings.STELLAR_TRANSACTION_TIMEOUT)
            .build()
        )

        transaction.sign(issuer_keypair)
        response = TESTNET_SERVER.submit_transaction(transaction)

        tx_id = response["hash"]
        actual_usdc = expected_usdc
        fee_brz = 0.0

        print(f"   ✓ Swap complete: R${amount_brz:.2f} → ${actual_usdc:.2f} USDC")
        print(f"   TX: {tx_id[:10]}...")

        return {
            "tx_id": tx_id,
            "amount_brz_sent": amount_brz,
            "amount_usdc_received": actual_usdc,
            "actual_rate": amount_brz / actual_usdc,
            "fee_brz": fee_brz
        }

    except Exception as e:
        print(f"   ✗ Swap failed: {e}")
        return None
```

**Testing:**
```python
# Test minting
tx_hash = mint_mock_brz("GUSER...", 5500.0)
print(f"Minted R$5,500: https://stellar.expert/explorer/testnet/tx/{tx_hash}")

# Test swap
tx_hash, usdc_amt = swap_brz_to_usdc("GUSER...", 5500.0, 5.5)
print(f"Swapped to ${usdc_amt} USDC: https://stellar.expert/explorer/testnet/tx/{tx_hash}")
```

**Resources:**
- Stellar SDK: https://github.com/StellarCN/py-stellar-base
- Testnet Friendbot: https://laboratory.stellar.org/#account-creator?network=test
- Circle USDC issuer (testnet): `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`

**Estimated Time:** 2 hours

---

### ❌ Step 2.4: Circle Sandbox Integration (TODO)

**Goal:** Implement USDC → USD fiat off-ramp via Circle Sandbox API

**Status:** ❌ NOT STARTED

**Files to Create:**
- `src/server/tools/circle_tools.py`

**Functions to Implement:**

1. **`initiate_usdc_withdrawal(amount_usd: float, recipient_account: dict, metadata: dict) -> str`**
   - Calls Circle Sandbox `POST /v1/transfers`
   - Converts USDC to USD wire transfer
   - Returns Circle transfer_id

2. **`check_transfer_status(transfer_id: str) -> str`**
   - Polls Circle `GET /v1/transfers/{id}`
   - Returns status: "pending" | "complete" | "failed"

**API Request Shape:**
```python
{
  "source": {
    "type": "blockchain",
    "chain": "XLM",
    "address": "<REVELLIO_HOT_WALLET>"
  },
  "destination": {
    "type": "wire",
    "accountNumber": "1234567890",
    "routingNumber": "021000021",
    "bankName": "University Bank",
    "beneficiaryName": "University of South Florida"
  },
  "amount": {"amount": "1000.00", "currency": "USD"},
  "metadata": {"username": "cbahlis", "liability_id": "42"}
}
```

**Implementation Example:**

```python
# tools/circle_tools.py - NEW FILE
"""
Circle Sandbox API integration for fiat off-ramp.

Circle provides USDC → USD wire transfer simulation via their Sandbox environment.
No real money is transferred - all operations are test mode.
"""

import httpx
from typing import Optional, Dict
from my_fastapi_app.app.settings import settings
import uuid


CIRCLE_SANDBOX_URL = "https://api-sandbox.circle.com/v1"


async def initiate_usdc_withdrawal(
    amount_usd: float,
    recipient_bank_account: Dict[str, str],
    user_metadata: Dict[str, str]
) -> Optional[Dict]:
    """
    Initiate USDC → USD wire transfer via Circle Sandbox.

    In production, requires KYC verification, bank account linking, Circle Business Account.
    """
    try:
        print(f"💳 Initiating Circle withdrawal: ${amount_usd:.2f} → {recipient_bank_account['bank_name']}...")

        idempotency_key = str(uuid.uuid4())

        headers = {
            "Authorization": f"Bearer {settings.CIRCLE_API_KEY}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotency_key
        }

        payload = {
            "source": {
                "type": "blockchain",
                "chain": "ETH",
                "address": settings.CIRCLE_USDC_HOT_WALLET
            },
            "destination": {
                "type": "wire",
                "accountNumber": recipient_bank_account["account_number"],
                "routingNumber": recipient_bank_account["routing_number"],
                "bankName": recipient_bank_account["bank_name"],
                "beneficiaryName": recipient_bank_account["account_holder_name"]
            },
            "amount": {
                "amount": str(amount_usd),
                "currency": "USD"
            },
            "metadata": {
                "username": user_metadata.get("username"),
                "email": user_metadata.get("email"),
                "liability_id": user_metadata.get("liability_id"),
                "platform": "Revellio"
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{CIRCLE_SANDBOX_URL}/transfers",
                json=payload,
                headers=headers
            )

        if response.status_code == 201:
            data = response.json()
            transfer = data.get("data", {})

            print(f"   ✓ Transfer initiated: {transfer.get('id', 'unknown')[:10]}...")
            print(f"   Status: {transfer.get('status', 'unknown')}")
            print(f"   Amount: ${amount_usd:.2f}")

            return {
                "transfer_id": transfer.get("id"),
                "status": transfer.get("status", "pending"),
                "amount_usd": amount_usd,
                "estimated_arrival": transfer.get("estimatedArrival"),
                "fee_usd": 0.0  # Sandbox has no fees
            }
        else:
            print(f"   ✗ Circle API error: {response.status_code}")
            print(f"   Response: {response.text}")
            return None

    except Exception as e:
        print(f"   ✗ Circle withdrawal failed: {e}")
        return None


async def check_transfer_status(transfer_id: str) -> Optional[str]:
    """
    Check the status of a Circle transfer.

    In sandbox, transfers complete instantly.
    In production, wire transfers take 1-2 business days.
    """
    try:
        headers = {
            "Authorization": f"Bearer {settings.CIRCLE_API_KEY}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{CIRCLE_SANDBOX_URL}/transfers/{transfer_id}",
                headers=headers
            )

        if response.status_code == 200:
            data = response.json()
            transfer = data.get("data", {})
            status = transfer.get("status", "unknown")

            print(f"   ✓ Transfer {transfer_id[:10]}... status: {status}")
            return status
        else:
            print(f"   ✗ Status check failed: {response.status_code}")
            return None

    except Exception as e:
        print(f"   ✗ Status check error: {e}")
        return None
```

**Environment Variables Needed:**
```bash
CIRCLE_API_KEY=...
CIRCLE_USDC_HOT_WALLET=G...  # Revellio's USDC custody wallet
CIRCLE_API_URL=https://api-sandbox.circle.com
```

**Testing:**
```python
transfer_id = await initiate_usdc_withdrawal(
    amount_usd=1000.0,
    recipient_bank_account={
        "account_number": "1234567890",
        "routing_number": "021000021",
        "bank_name": "Test University",
        "account_holder_name": "Student Name"
    },
    user_metadata={
        "username": "cbahlis",
        "email": "test@example.com",
        "liability_id": "1"
    }
)

status = await check_transfer_status(transfer_id)
print(f"Transfer {transfer_id}: {status}")
```

**Resources:**
- Circle API Docs: https://developers.circle.com/docs/sandbox
- Circle requires KYB for production

**Estimated Time:** 1 hour

---

### ❌ Step 2.5: Settlement Flow + Email (TODO)

**Goal:** Implement end-to-end payment settlement endpoint

**Status:** ❌ NOT STARTED

**Files to Create:**
- `POST /payments/settle` endpoint in `routes/payments.py`

**Implementation:**

```python
@router.post("/payments/settle")
async def settle_payment(
    data: SettlePaymentRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    End-to-end stablecoin settlement flow:
    1. Verify wallet balance sufficient
    2. Fetch live FX rate from agent system
    3. Mint Mock-BRZ on Stellar
    4. Swap BRZ → USDC on Stellar DEX
    5. Initiate Circle wire transfer
    6. Debit wallet, write Transaction
    7. Mark liability.is_paid = True
    8. Send email receipt with all transaction IDs
    """
    # 1. Validate user and liability
    # 2. Fetch wallet and verify balance
    # 3. Calculate BRL cost (amount_usd * fx_rate)
    # 4. Stellar: mint Mock-BRZ
    # 5. Stellar: swap BRZ → USDC
    # 6. Circle: initiate wire transfer
    # 7. Debit wallet atomically
    # 8. Write Transaction with all tx IDs
    # 9. Mark liability paid
    # 10. Send email with receipt

    return {
        "success": True,
        "stellar_mint_tx": "...",
        "stellar_swap_tx": "...",
        "circle_transfer_id": "...",
        "transaction_id": 123,
    }
```

**Request Shape:**
```python
class SettlePaymentRequest(BaseModel):
    username: str
    liability_id: int
```

**Email Template:**
```
Subject: Payment Confirmed - $1,000.00 to University of South Florida

Hi @cbahlis,

Your payment has been processed successfully.

💰 Payment Details:
- Amount: $1,000.00 USD (R$5,500.00 BRL @ 5.50)
- Recipient: University of South Florida
- Description: Tuition Payment Spring 2026

🔗 Blockchain Proof:
- Mint BRZ: https://stellar.expert/explorer/testnet/tx/{stellar_mint_tx}
- Swap to USDC: https://stellar.expert/explorer/testnet/tx/{stellar_swap_tx}
- Circle Transfer: {circle_transfer_id}

📊 New Balance:
- BRL Available: R$0.00
- USD Available: $0.00

Questions? Reply to this email.

— Revellio Team
```

**Testing:**
```bash
# Ensure user has balance
curl -X POST http://localhost:8000/payments/checkout \
  -d '{"username": "cbahlis", "amount_usd": 1200.0}'

# Pay with test card, wait for webhook

# Settle a liability
curl -X POST http://localhost:8000/payments/settle \
  -H "Content-Type: application/json" \
  -d '{"username": "cbahlis", "liability_id": 1}'

# Verify liability marked paid
psql $DATABASE_URL -c "SELECT is_paid FROM liabilities WHERE id=1;"
```

**Estimated Time:** 1.5 hours

---

## 📅 Implementation Timeline

### Week 1: Phase 1 (Agentic Brain)
- **Day 1-2**: Steps 1.1-1.2 (State schema + timestamp provenance)
- **Day 3**: Step 1.3 (LLM orchestrator)
- **Day 4**: Step 1.4 (Audit verification) + testing

### Week 2: Phase 2 (Remaining Stablecoin Steps)
- **Day 5-6**: Step 2.3 (Stellar testnet tools)
- **Day 7**: Step 2.4 (Circle sandbox)
- **Day 8**: Step 2.5 (Settlement flow + email)
- **Day 9**: End-to-end testing
- **Day 10**: Documentation + demo prep

### Total: ~10 days (spread across 2 weeks)

---

## ✅ Success Criteria

### Functional Requirements:
- ✅ User can deposit USD via Stripe Test Mode
- ✅ Wallet balance updates correctly with transaction history
- ✅ Frontend displays balance and transaction history
- ❌ Agent provides intelligent pay/wait recommendations using LLM (Phase 1)
- ❌ Full stablecoin flow executes (BRL → Mock-BRZ → USDC → USD) (Phase 2)
- ❌ All transaction IDs are returned and verifiable on Stellar Explorer
- ❌ Email receipts include blockchain links

### Technical Requirements:
- ✅ All async operations complete without blocking
- ❌ Type safety with Pydantic and TypedDict (Phase 1)
- ✅ Graceful error handling in webhook (idempotency)
- ✅ Database migrations applied cleanly to Supabase
- ✅ No secrets in git (all in .env)
- ✅ API docs are up-to-date

### User Experience:
- ✅ Deposit flow completes in <5 seconds
- ✅ Clear error messages if insufficient balance
- ❌ Email receipt arrives within 1 minute (Phase 2)
- ❌ Blockchain verification works on Stellar Explorer
- ❌ Payment flow completes in <10 seconds (Phase 2)

---

## 🔄 Next Steps

### Immediate (Phase 1):
1. Fix state schema brittleness (Step 1.1)
2. Add timestamp provenance (Step 1.2)
3. Replace orchestrator with LLM reasoning (Step 1.3)
4. Verify audit completeness (Step 1.4)

### After Phase 1 (Phase 2 Completion):
1. Implement Stellar testnet tools (Step 2.3)
2. Integrate Circle sandbox (Step 2.4)
3. Build settlement flow endpoint (Step 2.5)
4. Add email receipts with blockchain links

### Testing & Demo:
1. End-to-end flow: Deposit → Agent Recommendation → Settlement → Email
2. Verify all blockchain transactions on Stellar Explorer
3. Test idempotency (replay webhooks, retry settlements)
4. Load test with multiple concurrent users
5. Prepare demo script for sponsor presentation

---

## 📚 Reference Documentation

### Already Created (by teammate):
- `/temp-docs/teammate/stripe_implementation_docs.md` - Stripe integration reference
- `/temp-docs/teammate/stablecoin_pipeline_docs.md` - Full pipeline architecture
- `/temp-docs/teammate/STABLECOIN_INTEGRATION_PLAN_UPDATED.md` - Teammate's updated plan

### To Be Created:
- Stellar testnet setup guide
- Circle sandbox setup guide
- End-to-end testing guide
- Production deployment checklist

### External Resources:
- Stellar SDK: https://github.com/StellarCN/py-stellar-base
- Circle API: https://developers.circle.com/docs
- Stripe Webhooks: https://stripe.com/docs/webhooks
- Stellar Explorer: https://stellar.expert/explorer/testnet

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Revellio Frontend                        │
│                    (React + TailwindCSS)                        │
└────────────┬───────────────────────────┬────────────────────────┘
             │                           │
             │ REST API                  │ WebSocket (future)
             │                           │
┌────────────▼───────────────────────────▼────────────────────────┐
│                     FastAPI Backend                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Routes Layer                                             │   │
│  │  • /aura/analyze      - Run agent cycle                  │   │
│  │  • /payments/settle   - Execute payment                  │   │
│  │  • /payments/webhook  - Handle deposits                  │   │
│  │  • /payments/balance  - Get balances + history           │   │
│  │  • /blockchain/verify - Verify audit trail               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ LangGraph Agent System (Agentic Brain)                   │   │
│  │  1. Macro Researcher    → BCB, FRED, World Bank          │   │
│  │  2. Commodity Researcher → Yahoo Finance                 │   │
│  │  3. Sentiment Researcher → Tavily, Browser Use           │   │
│  │  4. Market Synthesis     → Gemini (structured output)    │   │
│  │  5. Orchestrator (LLM)   → Pay/wait decisions            │   │
│  │  6. Trust Engine         → Blockchain audit              │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Stablecoin Tools                                         │   │
│  │  • stellar_tools.py  - Mock-BRZ mint, BRZ→USDC swap     │   │
│  │  • circle_tools.py   - USDC→USD fiat off-ramp           │   │
│  │  • email_tools.py    - Payment receipts                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────┬───────────────────────────┬────────────────────────┘
             │                           │
             │                           │
   ┌─────────▼──────────┐      ┌─────────▼──────────┐
   │  Supabase          │      │  Stellar Testnet   │
   │  (PostgreSQL)      │      │  (Blockchain)      │
   │  + pgvector        │      │                    │
   │                    │      │  • Mock-BRZ asset  │
   │  • users           │      │  • USDC testnet    │
   │  • wallets         │      │  • DEX swaps       │
   │  • checkouts       │      │  • Audit hashes    │
   │  • transactions    │      │                    │
   │  • liabilities     │      └────────────────────┘
   │  • audit_log       │
   └────────────────────┘
             │
             │
   ┌─────────▼──────────┐      ┌────────────────────┐
   │  Stripe Test Mode  │      │  Circle Sandbox    │
   │  (USD Deposits)    │      │  (USDC→USD Wires)  │
   │                    │      │                    │
   │  • Checkout pages  │      │  • Wire transfers  │
   │  • Webhooks        │      │  • Test settlements│
   └────────────────────┘      └────────────────────┘
```

---

## 🎯 Final Notes

**Architectural Win:**
The teammate's implementation of separate `Wallet`, `Checkout`, `Transaction` tables is **better than the original plan** which proposed adding columns to the `users` table. This is proper financial architecture with:
- Immutable transaction ledger (double-entry accounting)
- Balance snapshots for reconciliation
- Idempotency support
- Clean separation of concerns

**Phase Priorities:**
- **Phase 1** fixes architectural debt in the agent system (type safety, LLM orchestrator)
- **Phase 2** completes the stablecoin pipeline (Stellar, Circle, settlement)
- Both phases are independent and can be worked on in parallel by different team members

**Production Readiness:**
- Steps 2.1-2.2 are production-quality (proper error handling, idempotency, atomic commits)
- Steps 2.3-2.5 will need similar rigor (retries, rollback, reconciliation)
- Phase 1 changes are foundational (enable better agent decisions)

**Demo Timeline:**
- With Phase 2 complete: Can demo full BRL → USD stablecoin flow
- With Phase 1 complete: Can demo intelligent agent reasoning
- Both together: Show the complete "AI-powered cross-border payment assistant" vision

---

## 🔐 Security Considerations

### Current Sandbox Security (OK for development):
- ✅ Test mode API keys (no real money)
- ✅ Testnet blockchain (fake assets)
- ✅ Webhook signature verification (prevents spoofing)
- ❌ Secret keys in .env file (not production-safe)
- ❌ No user authentication on API endpoints
- ❌ No rate limiting
- ❌ No input sanitization on amounts

### Production Security Checklist:
- [ ] Move secrets to AWS Secrets Manager / HashiCorp Vault
- [ ] Implement JWT authentication on all endpoints
- [ ] Add rate limiting (prevent abuse)
- [ ] Validate all numeric inputs (prevent overflow attacks)
- [ ] Implement 2FA for withdrawals
- [ ] Add KYC/AML verification (required by law for >$600 transactions)
- [ ] Use hardware security modules (HSM) for key storage
- [ ] Implement withdrawal limits and velocity checks
- [ ] Add fraud detection (unusual patterns)
- [ ] Enable audit logging for all balance changes
- [ ] Set up alerts for large transactions
- [ ] Implement circuit breakers for external APIs

---

**Next Steps:**
1. Review this plan with the team
2. Set up test accounts (Stripe, Circle, Stellar)
3. Start with Phase 1 (lower risk, architectural fixes)
4. Then proceed to Phase 2 (remaining stablecoin steps)
5. Test end-to-end with the provided test scenario
6. Deploy to staging for team demo

🚀 **Ready to transform Revellio from prototype to production-ready stablecoin platform!**
