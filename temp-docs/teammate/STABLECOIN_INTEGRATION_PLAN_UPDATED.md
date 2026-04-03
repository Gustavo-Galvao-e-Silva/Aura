# 🚀 Revellio Stablecoin Integration & Agentic Brain Upgrade Plan

**Created:** 2026-03-31
**Status:** Ready for Implementation
**Estimated Duration:** 8-12 hours (2 phases)

---

## 📋 Executive Summary

This plan addresses all architectural concerns raised in conversation.md and implements a complete stablecoin sandbox for Revellio. The work is divided into two major phases:

### Phase 1: Agentic Brain Upgrade (3-4 hours)
Fix four critical architectural issues identified in the agent system:
1. **State Schema Brittleness** - Replace `Dict[str, Any]` with typed structures
2. **Missing Timestamp Provenance** - Add `fetched_at` to audit trail
3. **Orchestrator Bottleneck** - Replace hardcoded if/elif with LLM reasoning
4. **Audit Completeness** - Include data freshness timestamp in blockchain hash

### Phase 2: Stablecoin Sandbox Implementation (4-6 hours)
Build complete Web2.5 stablecoin pipeline for testing without real money:
1. **Database Schema** - Add BRL/USD balance tracking and transaction ledger
2. **Stripe Webhooks** - Handle test mode BRL deposits
3. **Stellar Testnet Tools** - Mock-BRZ minting and USDC conversion
4. **Circle Sandbox** - Simulated fiat off-ramp (USDC → wire transfer)
5. **Settlement Flow** - End-to-end payment processing with email receipts

### Phase 3: Route Polish (30 minutes)
- Update API endpoints to return real balance data
- Surface transaction IDs in blockchain verification routes

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
4. **Need double-entry accounting** - Simple balance columns lose transaction history

**Solution Approach:**
- **Approach 1 (Database Ledger/Web2.5)**: Chosen for sandbox
  - Fiat stays in Stripe/bank accounts
  - PostgreSQL tracks stablecoin balances
  - Backend coordinates conversions via APIs
  - Stellar Testnet for blockchain simulation
  - Circle Sandbox for fiat off-ramp testing

---

## 🔍 Current State Analysis

### ✅ What's Already Working:

1. **Semantic Search (Phase 6 from MIGRATION_COMPLETE.md)**: ✅ DONE
   - pgvector extension enabled in PostgreSQL
   - `reasoning_embedding` column in AuditLog (models.py:37)
   - `generate_reasoning_embedding()` in tools/embeddings.py
   - trust.py generates 384-dim embeddings (trust.py:96-110)
   - `/blockchain/search/similar` endpoint (blockchain.py:68-145)
   - `/blockchain/search/contradictions` endpoint (blockchain.py:148-236)

2. **Async Database Operations (Phase 5 from migration)**: ✅ DONE
   - All agents use AsyncSession
   - orchestrator.py uses async/await (orchestrator.py:7-19)
   - Non-blocking I/O throughout

3. **Centralized Configuration (Phase 3 from migration)**: ✅ DONE
   - Type-safe settings.py with pydantic-settings
   - DEFAULT_BRL_BALANCE = 50000.0 (settings.py:112)
   - DEFAULT_USD_BALANCE = 0.0 (settings.py:113)

4. **Structured Outputs in Researchers**: ✅ MOSTLY DONE
   - SentimentAnalysis(BaseModel) for sentiment researcher (researchers.py:209-215)
   - MarketMetrics(BaseModel) defined in synthesis_node (researchers.py:526-534)
   - MarketAnalysisResponse(BaseModel) for Gemini output (researchers.py:536-541)
   - Using Gemini's `response_schema` to enforce JSON structure

### ❌ What Still Needs Fixing:

#### **Issue 1: State Schema Mismatch** (state.py:7)
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

#### **Issue 2: Missing Timestamp Provenance** (state.py + trust.py)
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

#### **Issue 3: Orchestrator Bottleneck** (orchestrator.py:58-103)
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

# Rule 6: NEUTRAL or low confidence → conservative (wait unless due soon)
else:
    if days_until_due <= 5:
        pay_now = True
        reason = f"Neutral market outlook, but bill due in {days_until_due} days..."
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

#### **Issue 4: No Stablecoin Infrastructure** (models.py + missing files)
**Current Code:**
```python
# models.py:39-45 (Users table)
class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fullname = Column(String, nullable=False)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    # MISSING: brl_balance, usd_balance columns!
```

**Problem:**
- No balance tracking for BRL or USD stablecoins
- No transaction ledger (violates double-entry accounting principle)
- No webhook handler for Stripe deposits
- No tools for Stellar testnet operations (Mock-BRZ minting, USDC conversion)
- No Circle Sandbox integration for fiat off-ramp

**Impact:**
- Can't test the end-to-end stablecoin flow
- Can't demonstrate to sponsor how BRL → Stable BRL → Stable USD → Fiat USD works
- No audit trail for balance changes (just overwrites, no history)

---

## 📦 Phase 1: Agentic Brain Upgrade

**Duration:** 3-4 hours
**Priority:** HIGH (fixes architectural debt)

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

### Step 2.1: Add Balance Tracking and Transaction Ledger

**Goal:** Extend Users model with BRL/USD balances and create transaction history table

**Files to Modify:**
- `src/server/db/models.py`

**Files to Create:**
- `src/server/alembic/versions/{timestamp}_add_stablecoin_tables.py` (auto-generated)

**New Database Schema:**

```python
# models.py - ADD these two new models

class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fullname = Column(String, nullable=False)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)

    # NEW: Stablecoin balance tracking
    brl_balance = Column(Float, nullable=False, default=50000.0)  # Mock-BRZ (R$50k starting)
    usd_balance = Column(Float, nullable=False, default=0.0)  # Stable USD (starts at $0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Transaction(Base):
    """
    Double-entry accounting ledger for all balance changes.
    Every balance change creates a transaction record for audit trail.
    """
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, ForeignKey("users.username"), nullable=False, index=True)

    # Transaction metadata
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    transaction_type = Column(String, nullable=False)  # "deposit", "conversion", "payment", "refund"
    status = Column(String, nullable=False, default="completed")  # "pending", "completed", "failed"

    # Amounts (positive = credit, negative = debit)
    brl_amount = Column(Float, nullable=False, default=0.0)  # Change in BRL balance
    usd_amount = Column(Float, nullable=False, default=0.0)  # Change in USD balance

    # Balances after this transaction (for easy reconciliation)
    brl_balance_after = Column(Float, nullable=False)
    usd_balance_after = Column(Float, nullable=False)

    # External reference IDs
    stripe_payment_intent_id = Column(String, nullable=True, index=True)  # Stripe deposit ID
    stellar_tx_id = Column(String, nullable=True, index=True)  # Stellar blockchain TX
    circle_transfer_id = Column(String, nullable=True, index=True)  # Circle settlement ID
    liability_id = Column(Integer, ForeignKey("liabilities.id"), nullable=True)  # Which bill was paid

    # Conversion details (for BRZ→USDC conversions)
    conversion_rate = Column(Float, nullable=True)  # Exchange rate used (e.g., 5.45 BRL/USD)
    conversion_fee_brl = Column(Float, nullable=True, default=0.0)  # DEX/swap fee

    # Human-readable description
    description = Column(String, nullable=False)  # e.g., "Stripe deposit via PIX", "Paid USF Tuition bill"

    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

**Create the Migration:**
```bash
cd src/server

# Generate migration file
docker-compose exec backend alembic revision --autogenerate -m "add_stablecoin_balances_and_transactions"

# Apply migration
docker-compose exec backend alembic upgrade head

# Verify tables exist
docker-compose exec backend psql -U postgres -d postgres -c "\d transactions"
```

**Update settings.py (already has these, but verify):**
```python
# settings.py:112-113 (already exists)
DEFAULT_BRL_BALANCE: float = 50000.0  # R$50,000 starting balance
DEFAULT_USD_BALANCE: float = 0.0  # $0 USD
```

**Testing:**
```bash
# Test creating a user with balances
docker-compose exec backend python -c "
from sqlalchemy.orm import Session
from db.models import Users, Transaction
from my_fastapi_app.app.db.session import engine

with Session(engine) as db:
    user = Users(
        fullname='Test Student',
        username='testuser',
        email='test@revellio.com',
        brl_balance=50000.0,
        usd_balance=0.0
    )
    db.add(user)
    db.commit()
    print(f'Created user: {user.username}, BRL: R\${user.brl_balance}, USD: \${user.usd_balance}')
"
```

**Estimated Time:** 1 hour

---

### Step 2.2: Stripe Webhook Handler (BRL Deposits)

**Goal:** Handle Stripe Test Mode webhooks for PIX deposits, credit user's BRL balance

**Files to Create:**
- `src/server/my_fastapi_app/app/routes/webhooks.py`

**Files to Modify:**
- `src/server/my_fastapi_app/app/main.py` (register webhook route)

**Implementation:**

```python
# routes/webhooks.py - NEW FILE
"""
Stripe webhook handler for test mode BRL deposits.

Stripe sends webhooks when:
1. payment_intent.succeeded - PIX payment completed
2. charge.failed - Payment failed
3. charge.refunded - Payment refunded

We only process payment_intent.succeeded to credit user's BRL balance.
"""

from fastapi import APIRouter, Request, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import stripe
import json

from my_fastapi_app.app.settings import settings
from my_fastapi_app.app.db.session import get_db
from db.models import Users, Transaction

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

# Configure Stripe (use test keys in sandbox)
stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeWebhookEvent(BaseModel):
    """Stripe webhook event structure."""
    id: str
    type: str
    data: dict


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Stripe webhooks for BRL deposits (Test Mode).

    Expected flow:
    1. User initiates BRL deposit via Stripe Checkout (PIX payment in Brazil)
    2. Stripe processes payment and sends webhook
    3. We verify webhook signature (security)
    4. Credit user's brl_balance in database
    5. Create transaction record for audit trail

    Test Mode: All payments use Stripe test cards/PIX
    """
    # Get raw body for signature verification
    payload = await request.body()

    # Verify webhook signature (prevents spoofing)
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    print(f"📨 Stripe Webhook: {event['type']}")

    # Only process successful payments
    if event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]

        # Extract metadata (set by frontend when creating payment)
        username = payment_intent["metadata"].get("username")
        amount_brl = payment_intent["amount"] / 100  # Stripe uses cents
        payment_intent_id = payment_intent["id"]

        if not username:
            print("   ⚠️  Missing username in payment metadata")
            return {"status": "ignored", "reason": "no_username"}

        # Find user
        result = await db.execute(
            select(Users).filter(Users.username == username)
        )
        user = result.scalar_one_or_none()

        if not user:
            print(f"   ⚠️  User not found: {username}")
            return {"status": "error", "reason": "user_not_found"}

        # Credit BRL balance (this is Mock-BRZ in sandbox)
        old_balance = user.brl_balance
        user.brl_balance += amount_brl

        # Create transaction record
        transaction = Transaction(
            username=username,
            transaction_type="deposit",
            status="completed",
            brl_amount=amount_brl,  # Positive = credit
            usd_amount=0.0,
            brl_balance_after=user.brl_balance,
            usd_balance_after=user.usd_balance,
            stripe_payment_intent_id=payment_intent_id,
            description=f"Stripe PIX deposit (Test Mode): R${amount_brl:.2f}"
        )

        db.add(transaction)
        await db.commit()

        print(f"✅ Credited {username}: R${amount_brl:.2f} (balance: R${old_balance:.2f} → R${user.brl_balance:.2f})")
        print(f"   Stripe Payment Intent: {payment_intent_id}")

        return {
            "status": "success",
            "username": username,
            "amount_brl": amount_brl,
            "new_balance_brl": user.brl_balance,
            "transaction_id": transaction.id
        }

    elif event["type"] == "payment_intent.payment_failed":
        print("   ⚠️  Payment failed")
        # Could create a failed transaction record here if needed
        return {"status": "ignored", "reason": "payment_failed"}

    else:
        print(f"   ℹ️  Unhandled event type: {event['type']}")
        return {"status": "ignored", "reason": "unhandled_event_type"}
```

**Register Route in main.py:**
```python
# main.py - ADD this import and registration
from my_fastapi_app.app.routes import webhooks

app.include_router(webhooks.router)
```

**Add to settings.py:**
```python
# settings.py - ADD these keys
STRIPE_SECRET_KEY: str  # sk_test_...
STRIPE_WEBHOOK_SECRET: str  # whsec_...
```

**Testing:**
```bash
# Use Stripe CLI to test webhook locally
stripe listen --forward-to localhost:8000/webhooks/stripe

# Trigger a test payment
stripe trigger payment_intent.succeeded --add payment_intent:metadata[username]=testuser --add payment_intent:amount=5000000  # R$50,000.00

# Check database
docker-compose exec backend psql -U postgres -d postgres -c "SELECT username, brl_balance FROM users WHERE username='testuser';"
docker-compose exec backend psql -U postgres -d postgres -c "SELECT * FROM transactions WHERE username='testuser' ORDER BY timestamp DESC LIMIT 1;"
```

**Estimated Time:** 1.5 hours

---

### Step 2.3: Stellar Testnet Tools (Mock-BRZ Operations)

**Goal:** Create utility functions for minting Mock-BRZ and swapping BRZ→USDC on Stellar testnet

**Files to Create:**
- `src/server/tools/stellar_tools.py`

**Implementation:**

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
# See setup instructions below
MOCK_BRZ_ISSUER = settings.STELLAR_MOCK_BRZ_ISSUER  # Testnet public key
MOCK_BRZ_ASSET = Asset("BRZ", MOCK_BRZ_ISSUER)

# USDC on Stellar testnet (real Circle test asset)
USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"  # Stellar testnet USDC
USDC_ASSET = Asset("USDC", USDC_ISSUER)


def ensure_account_exists(public_key: str) -> bool:
    """
    Check if a Stellar account exists on testnet.
    If not, fund it using Friendbot (testnet faucet).

    Returns True if account exists or was created successfully.
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
    This prevents spam assets from being sent to your account.

    Returns transaction ID if successful, None if failed.
    """
    try:
        # Load source account
        source_account = TESTNET_SERVER.load_account(user_keypair.public_key)

        # Build trustline transaction
        transaction = (
            TransactionBuilder(
                source_account=source_account,
                network_passphrase=TESTNET_NETWORK,
                base_fee=settings.STELLAR_BASE_FEE
            )
            .append_change_trust_op(asset=asset, limit="1000000")  # Trust up to 1M units
            .set_timeout(settings.STELLAR_TRANSACTION_TIMEOUT)
            .build()
        )

        # Sign and submit
        transaction.sign(user_keypair)
        response = TESTNET_SERVER.submit_transaction(transaction)

        tx_id = response["hash"]
        print(f"   ✓ Trustline established for {asset.code}: {tx_id[:10]}...")
        return tx_id

    except BadRequestError as e:
        # Trustline already exists is OK
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
    In production, this would be done by a regulated stablecoin issuer (like Mercado Bitcoin).

    Args:
        user_public_key: User's Stellar testnet public key
        amount_brl: Amount of BRL to mint as Mock-BRZ (e.g., 5000.0 = R$5,000)

    Returns:
        Stellar transaction ID if successful, None if failed
    """
    try:
        print(f"🪙 Minting R${amount_brl:.2f} Mock-BRZ for {user_public_key[:10]}...")

        # Ensure user account exists
        if not ensure_account_exists(user_public_key):
            print("   ✗ Cannot mint: user account does not exist")
            return None

        # Load issuer keypair (this is YOUR testnet account that issues Mock-BRZ)
        issuer_keypair = Keypair.from_secret(settings.STELLAR_SECRET_KEY)
        issuer_account = TESTNET_SERVER.load_account(issuer_keypair.public_key)

        # Build payment transaction
        transaction = (
            TransactionBuilder(
                source_account=issuer_account,
                network_passphrase=TESTNET_NETWORK,
                base_fee=settings.STELLAR_BASE_FEE
            )
            .append_payment_op(
                destination=user_public_key,
                asset=MOCK_BRZ_ASSET,
                amount=str(amount_brl)  # Stellar uses string amounts
            )
            .set_timeout(settings.STELLAR_TRANSACTION_TIMEOUT)
            .build()
        )

        # Sign and submit
        transaction.sign(issuer_keypair)
        response = TESTNET_SERVER.submit_transaction(transaction)

        tx_id = response["hash"]
        print(f"   ✓ Minted R${amount_brl:.2f} Mock-BRZ: {tx_id[:10]}...")
        print(f"   Stellar Explorer: https://stellar.expert/explorer/testnet/tx/{tx_id}")

        return tx_id

    except BadRequestError as e:
        # Check if it's a trustline issue
        if "op_no_trust" in str(e):
            print(f"   ⚠️  User has not established trustline for Mock-BRZ")
            print(f"   Attempting to establish trustline first...")

            # Try to establish trustline on behalf of user (requires user's secret key)
            # In production, user would do this via frontend wallet
            # For sandbox, we assume user's Stellar key is derived from their username
            # This is a simplification - in reality, use proper key management
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
    expected_rate: float = 5.5  # BRL/USD rate
) -> Optional[dict]:
    """
    Swap Mock-BRZ → USDC using Stellar testnet DEX.

    This simulates converting BRL stablecoin → USD stablecoin on-chain.
    Uses Stellar's built-in decentralized exchange (DEX) with path payments.

    Args:
        user_public_key: User's Stellar testnet public key
        amount_brz: Amount of Mock-BRZ to convert (e.g., 5500.0 = R$5,500)
        expected_rate: Expected BRL/USD rate (e.g., 5.5 means R$5.50 = $1.00)

    Returns:
        Dict with swap details if successful:
        {
            "tx_id": "abc123...",
            "amount_brz_sent": 5500.0,
            "amount_usdc_received": 1000.0,
            "actual_rate": 5.5,
            "fee_brz": 0.5  # DEX spread/fee
        }
        Returns None if swap failed.
    """
    try:
        print(f"🔄 Swapping R${amount_brz:.2f} Mock-BRZ → USDC (rate: {expected_rate:.4f})...")

        # Calculate expected USDC output
        expected_usdc = amount_brz / expected_rate
        min_usdc = expected_usdc * 0.98  # Allow 2% slippage

        print(f"   Expected: ${expected_usdc:.2f} USDC (min: ${min_usdc:.2f})")

        # For sandbox, we'll simulate the swap with a direct payment
        # In production, you'd use Stellar's path payment operation
        # which automatically finds the best rate across liquidity pools

        # Load issuer account (acts as market maker in sandbox)
        issuer_keypair = Keypair.from_secret(settings.STELLAR_SECRET_KEY)
        issuer_account = TESTNET_SERVER.load_account(issuer_keypair.public_key)

        # Build swap transaction (simplified: we're the liquidity provider)
        # Step 1: User sends us Mock-BRZ
        # Step 2: We send user USDC
        # In reality, this would be atomic via path payment

        transaction = (
            TransactionBuilder(
                source_account=issuer_account,
                network_passphrase=TESTNET_NETWORK,
                base_fee=settings.STELLAR_BASE_FEE
            )
            # Send USDC to user
            .append_payment_op(
                destination=user_public_key,
                asset=USDC_ASSET,
                amount=str(round(expected_usdc, 2))
            )
            # Optionally: receive Mock-BRZ back (omitted for simplicity)
            .set_timeout(settings.STELLAR_TRANSACTION_TIMEOUT)
            .build()
        )

        transaction.sign(issuer_keypair)
        response = TESTNET_SERVER.submit_transaction(transaction)

        tx_id = response["hash"]
        actual_usdc = expected_usdc  # In sandbox, we get exactly the expected amount
        fee_brz = 0.0  # No fee in sandbox

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


# ============================================================================
# Setup Instructions (run once)
# ============================================================================

def setup_mock_brz_issuer():
    """
    One-time setup: Create the Mock-BRZ issuer account on Stellar testnet.

    Run this once when setting up the sandbox:

    ```bash
    docker-compose exec backend python -c "from tools.stellar_tools import setup_mock_brz_issuer; setup_mock_brz_issuer()"
    ```

    This will:
    1. Create a new Stellar testnet keypair
    2. Fund it via Friendbot
    3. Print the public key (add to settings.py as STELLAR_MOCK_BRZ_ISSUER)
    """
    print("🔧 Setting up Mock-BRZ issuer account on Stellar testnet...")

    # Generate new keypair
    issuer_keypair = Keypair.random()
    public_key = issuer_keypair.public_key
    secret_key = issuer_keypair.secret

    print(f"   Generated keypair:")
    print(f"   Public:  {public_key}")
    print(f"   Secret:  {secret_key}")
    print(f"   ⚠️  Save the secret key securely!")

    # Fund via Friendbot
    if ensure_account_exists(public_key):
        print(f"✅ Mock-BRZ issuer ready!")
        print(f"")
        print(f"Add these to your .env file:")
        print(f"STELLAR_MOCK_BRZ_ISSUER={public_key}")
        print(f"STELLAR_SECRET_KEY={secret_key}  # (if not already set)")
    else:
        print(f"❌ Setup failed")


if __name__ == "__main__":
    # Run setup if called directly
    setup_mock_brz_issuer()
```

**Add to settings.py:**
```python
# settings.py - ADD this
STELLAR_MOCK_BRZ_ISSUER: str  # Public key of Mock-BRZ issuer
```

**Run Setup:**
```bash
cd src/server
docker-compose exec backend python tools/stellar_tools.py

# Copy the generated keys to .env
echo "STELLAR_MOCK_BRZ_ISSUER=GXXXXX..." >> .env
```

**Testing:**
```bash
# Test minting Mock-BRZ
docker-compose exec backend python -c "
from tools.stellar_tools import mint_mock_brz
# Use a test public key (generated via stellar-sdk or friendbot)
tx_id = mint_mock_brz('GXXXXX...', 5000.0)
print(f'Minted TX: {tx_id}')
"

# Test swapping
docker-compose exec backend python -c "
from tools.stellar_tools import swap_brz_to_usdc
result = swap_brz_to_usdc('GXXXXX...', 5500.0, expected_rate=5.5)
print(f'Swap result: {result}')
"
```

**Estimated Time:** 2 hours

---

### Step 2.4: Circle Sandbox Integration (USDC → USD)

**Goal:** Simulate fiat off-ramp using Circle's Sandbox API (USDC → wire transfer)

**Files to Create:**
- `src/server/tools/circle_tools.py`

**Implementation:**

```python
# tools/circle_tools.py - NEW FILE
"""
Circle Sandbox API integration for fiat off-ramp.

Circle provides USDC → USD wire transfer simulation via their Sandbox environment.
No real money is transferred - all operations are test mode.

API Docs: https://developers.circle.com/docs/sandbox
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

    This simulates converting stablecoin USDC to fiat USD in the user's bank account.
    In production, this requires:
    1. KYC verification
    2. Bank account linking
    3. Circle Business Account

    For sandbox, we use test data.

    Args:
        amount_usd: Amount in USD to withdraw (e.g., 1000.00)
        recipient_bank_account: Dict with bank details:
            {
                "account_number": "1234567890",
                "routing_number": "021000021",
                "bank_name": "Test Bank",
                "account_holder_name": "John Student"
            }
        user_metadata: Additional context:
            {
                "username": "testuser",
                "email": "test@revellio.com",
                "liability_id": "123"  # Which bill this pays
            }

    Returns:
        Dict with transfer details:
        {
            "transfer_id": "abc-123-def",
            "status": "pending",  # "pending" | "complete" | "failed"
            "amount_usd": 1000.00,
            "estimated_arrival": "2026-04-02T10:00:00Z",  # 1-2 business days
            "fee_usd": 0.00  # Circle charges 0.5-1% in production
        }
    """
    try:
        print(f"💳 Initiating Circle withdrawal: ${amount_usd:.2f} → {recipient_bank_account['bank_name']}...")

        # Generate idempotency key (prevents duplicate withdrawals)
        idempotency_key = str(uuid.uuid4())

        # Build API request
        headers = {
            "Authorization": f"Bearer {settings.CIRCLE_API_KEY}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotency_key
        }

        payload = {
            "source": {
                "type": "blockchain",
                "chain": "ETH",  # USDC on Ethereum (or use "ALGO", "SOL", etc.)
                "address": settings.CIRCLE_USDC_HOT_WALLET  # Your Circle hot wallet address
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

    Returns:
        Status string: "pending" | "complete" | "failed" | None
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

**Add to settings.py:**
```python
# settings.py - ADD these
CIRCLE_API_KEY: str  # Sandbox API key from Circle dashboard
CIRCLE_USDC_HOT_WALLET: str  # Your Circle hot wallet address (for USDC custody)
```

**Testing:**
```bash
# Test withdrawal (sandbox completes instantly)
docker-compose exec backend python -c "
import asyncio
from tools.circle_tools import initiate_usdc_withdrawal

result = asyncio.run(initiate_usdc_withdrawal(
    amount_usd=1000.00,
    recipient_bank_account={
        'account_number': '1234567890',
        'routing_number': '021000021',
        'bank_name': 'Test Bank',
        'account_holder_name': 'John Student'
    },
    user_metadata={
        'username': 'testuser',
        'email': 'test@revellio.com',
        'liability_id': '123'
    }
))
print(f'Result: {result}')
"
```

**Estimated Time:** 1 hour

---

### Step 2.5: End-to-End Settlement Flow

**Goal:** Wire together all pieces into a single "pay bill" endpoint with email receipts

**Files to Create:**
- `src/server/my_fastapi_app/app/routes/payments.py`

**Files to Modify:**
- `src/server/my_fastapi_app/app/main.py` (register payments route)

**Implementation:**

```python
# routes/payments.py - NEW FILE
"""
End-to-end payment settlement flow.

This connects all the pieces:
1. User has BRL balance (from Stripe deposit)
2. Convert BRL → Mock-BRZ (Stellar testnet mint)
3. Swap Mock-BRZ → USDC (Stellar testnet DEX)
4. Off-ramp USDC → USD (Circle sandbox wire transfer)
5. Mark liability as paid
6. Send email receipt with all transaction IDs
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from my_fastapi_app.app.settings import settings
from my_fastapi_app.app.db.session import get_db
from db.models import Users, Liability, Transaction
from tools.stellar_tools import mint_mock_brz, swap_brz_to_usdc
from tools.circle_tools import initiate_usdc_withdrawal
from tools.email_tools import send_payment_receipt  # You'll need to create this

router = APIRouter(prefix="/payments", tags=["Payments"])


class PaymentRequest(BaseModel):
    """Request to pay a specific liability using stablecoin flow."""
    username: str
    liability_id: int
    # Optional: User's Stellar public key (if they have one)
    # For sandbox, we'll generate ephemeral keys
    stellar_public_key: Optional[str] = None


class PaymentResponse(BaseModel):
    """Response with all transaction details."""
    status: str  # "success" | "failed"
    message: str
    liability_id: int
    amount_usd: float
    amount_brl_spent: float
    fx_rate: float

    # Transaction IDs for audit trail
    stellar_mint_tx: Optional[str]
    stellar_swap_tx: Optional[str]
    circle_transfer_id: Optional[str]
    database_transaction_id: int

    # Balances after payment
    new_balance_brl: float
    new_balance_usd: float


@router.post("/settle", response_model=PaymentResponse)
async def settle_payment(
    payment: PaymentRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Execute end-to-end stablecoin payment flow.

    Flow:
    1. Verify user has sufficient BRL balance
    2. Fetch current FX rate
    3. Convert BRL → Mock-BRZ (Stellar mint)
    4. Swap Mock-BRZ → USDC (Stellar DEX)
    5. Off-ramp USDC → USD (Circle wire)
    6. Update database balances and mark bill paid
    7. Send email receipt

    This is the "magic" that happens when user clicks "Pay Now" in the UI.
    """
    print(f"💰 Starting payment settlement for {payment.username}, liability {payment.liability_id}")

    # 1. Load user and liability
    user_result = await db.execute(
        select(Users).filter(Users.username == payment.username)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    liability_result = await db.execute(
        select(Liability).filter(
            Liability.id == payment.liability_id,
            Liability.username == payment.username
        )
    )
    liability = liability_result.scalar_one_or_none()

    if not liability:
        raise HTTPException(status_code=404, detail="Liability not found")

    if liability.is_paid:
        raise HTTPException(status_code=400, detail="Liability already paid")

    amount_usd = liability.amount

    # 2. Get current FX rate (from route facts or live API)
    # For sandbox, we'll use a simple rate
    fx_rate = 5.5  # R$5.50 = $1.00 (you'd fetch this from FX API in production)
    amount_brl = amount_usd * fx_rate

    # 3. Verify sufficient balance
    if user.brl_balance < amount_brl:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient BRL balance. Need R${amount_brl:.2f}, have R${user.brl_balance:.2f}"
        )

    print(f"   Converting ${amount_usd:.2f} USD (R${amount_brl:.2f} @ {fx_rate:.4f})")

    # 4. Execute stablecoin flow
    stellar_mint_tx = None
    stellar_swap_tx = None
    circle_transfer_id = None

    try:
        # Step 4a: Mint Mock-BRZ on Stellar testnet
        # In production, this would be done by Mercado Bitcoin or similar
        # Here, we simulate it by minting from our issuer account
        stellar_public_key = payment.stellar_public_key or settings.STELLAR_HOT_WALLET

        stellar_mint_tx = mint_mock_brz(stellar_public_key, amount_brl)
        if not stellar_mint_tx:
            raise Exception("Failed to mint Mock-BRZ on Stellar")

        print(f"   ✓ Minted R${amount_brl:.2f} Mock-BRZ: {stellar_mint_tx[:10]}...")

        # Step 4b: Swap Mock-BRZ → USDC on Stellar DEX
        swap_result = swap_brz_to_usdc(stellar_public_key, amount_brl, fx_rate)
        if not swap_result:
            raise Exception("Failed to swap Mock-BRZ → USDC")

        stellar_swap_tx = swap_result["tx_id"]
        amount_usdc = swap_result["amount_usdc_received"]

        print(f"   ✓ Swapped R${amount_brl:.2f} → ${amount_usdc:.2f} USDC: {stellar_swap_tx[:10]}...")

        # Step 4c: Off-ramp USDC → USD via Circle
        circle_result = await initiate_usdc_withdrawal(
            amount_usd=amount_usdc,
            recipient_bank_account={
                "account_number": liability.name,  # Simplified: use bill name as account
                "routing_number": "021000021",
                "bank_name": "Test Bank",
                "account_holder_name": user.fullname
            },
            user_metadata={
                "username": user.username,
                "email": user.email,
                "liability_id": str(liability.id)
            }
        )

        if not circle_result:
            raise Exception("Failed to initiate Circle withdrawal")

        circle_transfer_id = circle_result["transfer_id"]

        print(f"   ✓ Initiated Circle wire transfer: {circle_transfer_id[:10]}...")

    except Exception as e:
        print(f"   ✗ Payment flow failed: {e}")
        raise HTTPException(status_code=500, detail=f"Payment processing failed: {e}")

    # 5. Update database
    try:
        # Deduct BRL balance
        old_brl_balance = user.brl_balance
        user.brl_balance -= amount_brl

        # Mark liability as paid
        liability.is_paid = True

        # Create transaction record
        transaction = Transaction(
            username=user.username,
            transaction_type="payment",
            status="completed",
            brl_amount=-amount_brl,  # Negative = debit
            usd_amount=amount_usd,  # This went to the bill, not our USD balance
            brl_balance_after=user.brl_balance,
            usd_balance_after=user.usd_balance,  # USD balance unchanged (went directly to bill)
            stellar_tx_id=stellar_swap_tx,  # Most relevant Stellar TX
            circle_transfer_id=circle_transfer_id,
            liability_id=liability.id,
            conversion_rate=fx_rate,
            description=f"Paid {liability.name} (${amount_usd:.2f}) via stablecoin flow"
        )

        db.add(transaction)
        await db.commit()
        await db.refresh(transaction)

        print(f"✅ Payment complete!")
        print(f"   BRL Balance: R${old_brl_balance:.2f} → R${user.brl_balance:.2f}")
        print(f"   Liability: {liability.name} marked as paid")

    except Exception as e:
        await db.rollback()
        print(f"   ✗ Database update failed: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    # 6. Send email receipt
    try:
        await send_payment_receipt(
            user_email=user.email,
            user_name=user.fullname,
            bill_name=liability.name,
            amount_usd=amount_usd,
            amount_brl=amount_brl,
            fx_rate=fx_rate,
            stellar_mint_tx=stellar_mint_tx,
            stellar_swap_tx=stellar_swap_tx,
            circle_transfer_id=circle_transfer_id
        )
        print(f"   ✓ Email receipt sent to {user.email}")
    except Exception as e:
        print(f"   ⚠️  Email failed (non-fatal): {e}")

    # 7. Return response
    return PaymentResponse(
        status="success",
        message=f"Successfully paid {liability.name} for ${amount_usd:.2f}",
        liability_id=liability.id,
        amount_usd=amount_usd,
        amount_brl_spent=amount_brl,
        fx_rate=fx_rate,
        stellar_mint_tx=stellar_mint_tx,
        stellar_swap_tx=stellar_swap_tx,
        circle_transfer_id=circle_transfer_id,
        database_transaction_id=transaction.id,
        new_balance_brl=user.brl_balance,
        new_balance_usd=user.usd_balance
    )
```

**Create Email Tool (tools/email_tools.py):**
```python
# tools/email_tools.py - NEW FILE
"""Email notification tools for payment receipts."""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from my_fastapi_app.app.settings import settings


async def send_payment_receipt(
    user_email: str,
    user_name: str,
    bill_name: str,
    amount_usd: float,
    amount_brl: float,
    fx_rate: float,
    stellar_mint_tx: str,
    stellar_swap_tx: str,
    circle_transfer_id: str
):
    """Send payment receipt email with all transaction details."""

    subject = f"✅ Payment Confirmed: {bill_name}"

    body = f"""
Hi {user_name},

Your payment has been successfully processed!

Bill Paid: {bill_name}
Amount: ${amount_usd:.2f} USD

Payment Details:
- You spent: R${amount_brl:.2f} BRL
- Exchange rate: R${fx_rate:.4f} / USD
- Total savings: [calculated based on FX comparison]

Blockchain Audit Trail:
1. Mock-BRZ Mint: https://stellar.expert/explorer/testnet/tx/{stellar_mint_tx}
2. BRZ → USDC Swap: https://stellar.expert/explorer/testnet/tx/{stellar_swap_tx}
3. Circle Wire Transfer: {circle_transfer_id}

All transactions are verifiable on the blockchain. Your payment is cryptographically guaranteed and cannot be reversed.

Need help? Contact support@revellio.com

Best regards,
The Revellio Team
"""

    # Send via SMTP (if configured)
    if settings.SMTP_HOST and settings.SMTP_USER:
        try:
            msg = MIMEMultipart()
            msg["From"] = settings.from_email
            msg["To"] = user_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

            print(f"   ✓ Email sent to {user_email}")
        except Exception as e:
            print(f"   ✗ Email failed: {e}")
            # Non-fatal error
    else:
        print(f"   ℹ️  SMTP not configured, skipping email")
        print(f"   Would have sent to {user_email}:")
        print(body)
```

**Register Route:**
```python
# main.py - ADD this
from my_fastapi_app.app.routes import payments

app.include_router(payments.router)
```

**Add to settings.py:**
```python
# settings.py - ADD this
STELLAR_HOT_WALLET: str  # Your default Stellar hot wallet for custody
```

**Testing:**
```bash
# Create a test bill
docker-compose exec backend python -c "
from sqlalchemy.orm import Session
from db.models import Liability
from my_fastapi_app.app.db.session import engine
from datetime import date, timedelta

with Session(engine) as db:
    bill = Liability(
        username='testuser',
        name='USF Tuition',
        amount=1000.0,
        currency='USD',
        due_date=date.today() + timedelta(days=30),
        is_predicted=False,
        is_paid=False
    )
    db.add(bill)
    db.commit()
    print(f'Created bill ID: {bill.id}')
"

# Test the full payment flow
curl -X POST http://localhost:8000/payments/settle \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "liability_id": 1
  }'

# Verify database state
docker-compose exec backend psql -U postgres -d postgres -c "
SELECT username, brl_balance, usd_balance FROM users WHERE username='testuser';
"

docker-compose exec backend psql -U postgres -d postgres -c "
SELECT * FROM transactions WHERE username='testuser' ORDER BY timestamp DESC LIMIT 1;
"
```

**Estimated Time:** 1.5 hours

---

### Phase 2 Summary

**Total Time:** 4-6 hours
**Files Created:** 5 new files
- `routes/webhooks.py` (Stripe deposits)
- `routes/payments.py` (settlement flow)
- `tools/stellar_tools.py` (blockchain operations)
- `tools/circle_tools.py` (fiat off-ramp)
- `tools/email_tools.py` (receipts)

**Files Modified:** 3 files
- `db/models.py` (Users + Transaction tables)
- `my_fastapi_app/app/main.py` (register routes)
- `my_fastapi_app/app/settings.py` (new API keys)

**Database Changes:**
- Added `brl_balance`, `usd_balance` columns to Users
- Created `Transaction` table with full audit trail

**What This Achieves:**
✅ Complete Web2.5 stablecoin flow (Approach 1 from conversation.md)
✅ Stripe Test Mode for BRL deposits
✅ Stellar Testnet for Mock-BRZ and USDC operations
✅ Circle Sandbox for fiat off-ramp
✅ Double-entry accounting in transaction ledger
✅ Email receipts with all transaction IDs

**Testing Checklist:**
- [ ] Test Stripe webhook with `stripe trigger payment_intent.succeeded`
- [ ] Verify BRL balance increases after Stripe deposit
- [ ] Test Mock-BRZ minting on Stellar testnet
- [ ] Test BRZ → USDC swap
- [ ] Test full payment settlement flow via `/payments/settle`
- [ ] Verify transaction records in database
- [ ] Check email receipt (if SMTP configured)
- [ ] Verify liability marked as paid

---

## 📦 Phase 3: Route Polish

**Duration:** 30 minutes
**Priority:** MEDIUM (UI/UX improvements)

### Step 3.1: Update API Endpoints

**Goal:** Surface balance data and transaction IDs in existing routes

**Files to Modify:**
- `src/server/my_fastapi_app/app/routes/blockchain.py` (add balance info)
- Create `src/server/my_fastapi_app/app/routes/balances.py` (new endpoint)

**Implementation:**

```python
# routes/balances.py - NEW FILE
"""User balance and transaction history endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from my_fastapi_app.app.db.session import get_db
from db.models import Users, Transaction

router = APIRouter(prefix="/balances", tags=["Balances"])


class BalanceResponse(BaseModel):
    """User's current stablecoin balances."""
    username: str
    brl_balance: float
    usd_balance: float
    total_usd_equivalent: float  # Total value in USD


class TransactionHistoryItem(BaseModel):
    """Single transaction record."""
    id: int
    timestamp: str
    transaction_type: str
    status: str
    brl_amount: float
    usd_amount: float
    description: str

    # External IDs
    stripe_payment_intent_id: Optional[str]
    stellar_tx_id: Optional[str]
    circle_transfer_id: Optional[str]

    # Links for verification
    stellar_explorer_url: Optional[str]


@router.get("/{username}", response_model=BalanceResponse)
async def get_user_balances(
    username: str,
    db: AsyncSession = Depends(get_db)
):
    """Get user's current BRL and USD balances."""
    result = await db.execute(
        select(Users).filter(Users.username == username)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Calculate total value in USD
    # For simplicity, assume Mock-BRZ has same value as real BRL
    fx_rate = 5.5  # Would fetch live rate in production
    total_usd = user.usd_balance + (user.brl_balance / fx_rate)

    return BalanceResponse(
        username=user.username,
        brl_balance=user.brl_balance,
        usd_balance=user.usd_balance,
        total_usd_equivalent=total_usd
    )


@router.get("/{username}/history", response_model=List[TransactionHistoryItem])
async def get_transaction_history(
    username: str,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Get user's transaction history with pagination."""
    result = await db.execute(
        select(Transaction)
        .filter(Transaction.username == username)
        .order_by(Transaction.timestamp.desc())
        .limit(limit)
        .offset(offset)
    )
    transactions = result.scalars().all()

    # Format response
    history = []
    for tx in transactions:
        history.append(TransactionHistoryItem(
            id=tx.id,
            timestamp=tx.timestamp.isoformat(),
            transaction_type=tx.transaction_type,
            status=tx.status,
            brl_amount=tx.brl_amount,
            usd_amount=tx.usd_amount,
            description=tx.description,
            stripe_payment_intent_id=tx.stripe_payment_intent_id,
            stellar_tx_id=tx.stellar_tx_id,
            circle_transfer_id=tx.circle_transfer_id,
            stellar_explorer_url=f"https://stellar.expert/explorer/testnet/tx/{tx.stellar_tx_id}" if tx.stellar_tx_id else None
        ))

    return history
```

**Register Route:**
```python
# main.py - ADD this
from my_fastapi_app.app.routes import balances

app.include_router(balances.router)
```

**Testing:**
```bash
# Get user balances
curl http://localhost:8000/balances/testuser

# Get transaction history
curl http://localhost:8000/balances/testuser/history?limit=10
```

**Estimated Time:** 30 minutes

---

### Phase 3 Summary

**Total Time:** 30 minutes
**Files Created:** 1 file
- `routes/balances.py`

**What This Achieves:**
✅ Frontend can fetch real balance data
✅ Transaction history with audit trail
✅ Links to Stellar Explorer for verification

---

## 🧪 Full System Testing

### Test Scenario: International Student Pays Tuition

**Goal:** Simulate the complete user journey from BRL deposit to USD bill payment

**Setup:**
```bash
cd src/server
docker-compose up -d
docker-compose logs -f backend
```

**Step-by-Step Test:**

1. **Create User**
```bash
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{
    "fullname": "Maria Silva",
    "username": "maria",
    "email": "maria@example.com"
  }'
```

2. **Simulate Stripe Deposit (R$10,000)**
```bash
stripe trigger payment_intent.succeeded \
  --add payment_intent:metadata[username]=maria \
  --add payment_intent:amount=1000000  # R$10,000 (in cents)
```

3. **Check Balance**
```bash
curl http://localhost:8000/balances/maria
# Should show: brl_balance = 60000.0 (50k starting + 10k deposit)
```

4. **Create Tuition Bill**
```bash
curl -X POST http://localhost:8000/liabilities \
  -H "Content-Type: application/json" \
  -d '{
    "username": "maria",
    "name": "USF Spring Semester Tuition",
    "amount": 1800.0,
    "currency": "USD",
    "due_date": "2026-05-15",
    "is_predicted": false
  }'
# Returns liability_id (e.g., 42)
```

5. **Run Aura Agent (Get Recommendation)**
```bash
curl -X POST http://localhost:8000/aura/analyze \
  -H "Content-Type: application/json" \
  -d '{"username": "maria"}'

# Returns:
# {
#   "market_prediction": "BULLISH",
#   "confidence": 0.75,
#   "thesis": "Strong rate differential favors BRL...",
#   "payment_decisions": [
#     {
#       "liability_id": 42,
#       "pay": true,
#       "reason": "Strong BULLISH signal, lock in favorable rate now"
#     }
#   ]
# }
```

6. **Execute Payment**
```bash
curl -X POST http://localhost:8000/payments/settle \
  -H "Content-Type: application/json" \
  -d '{
    "username": "maria",
    "liability_id": 42
  }'

# Returns:
# {
#   "status": "success",
#   "amount_usd": 1800.0,
#   "amount_brl_spent": 9900.0,  # (1800 * 5.5)
#   "fx_rate": 5.5,
#   "stellar_mint_tx": "abc123...",
#   "stellar_swap_tx": "def456...",
#   "circle_transfer_id": "ghi789...",
#   "new_balance_brl": 50100.0  # (60000 - 9900)
# }
```

7. **Verify on Blockchain**
```bash
# Visit Stellar Explorer
open "https://stellar.expert/explorer/testnet/tx/abc123..."

# Check audit log
curl "http://localhost:8000/blockchain/verify/def456..."
```

8. **Check Transaction History**
```bash
curl http://localhost:8000/balances/maria/history

# Should show:
# 1. Stripe deposit: +R$10,000
# 2. Payment: -R$9,900 for USF Tuition
```

9. **Check Email Receipt**
- Maria should receive email with:
  - Payment confirmation
  - All transaction IDs
  - Links to Stellar Explorer
  - Savings vs traditional wire transfer

**Success Criteria:**
- ✅ User can deposit BRL via Stripe Test Mode
- ✅ Agent provides intelligent pay/wait recommendation
- ✅ Payment flow executes without errors
- ✅ All transaction IDs are returned and valid
- ✅ Database balances are correct
- ✅ Transaction history is complete
- ✅ Blockchain TX is verifiable on Stellar Explorer
- ✅ Email receipt is sent

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
│  │  • /webhooks/stripe   - Handle deposits                  │   │
│  │  • /balances/{user}   - Get balances + history           │   │
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
   │  PostgreSQL        │      │  Stellar Testnet   │
   │  + pgvector        │      │  (Blockchain)      │
   │                    │      │                    │
   │  • users           │      │  • Mock-BRZ asset  │
   │  • liabilities     │      │  • USDC testnet    │
   │  • transactions    │      │  • DEX swaps       │
   │  • audit_log       │      │  • Audit hashes    │
   └────────────────────┘      └────────────────────┘
             │
             │
   ┌─────────▼──────────┐      ┌────────────────────┐
   │  Stripe Test Mode  │      │  Circle Sandbox    │
   │  (BRL Deposits)    │      │  (USDC→USD Wires)  │
   │                    │      │                    │
   │  • PIX payments    │      │  • Wire transfers  │
   │  • Webhooks        │      │  • Test settlements│
   └────────────────────┘      └────────────────────┘
```

---

## 🎓 Key Design Decisions

### 1. Web2.5 vs Web3 Approach

**Decision:** Build Database Ledger (Web2.5) approach first

**Rationale (from conversation.md):**
- Sponsor wants to "see stablecoins in action" but team needs sandbox
- Web2.5 keeps complexity manageable while demonstrating the concept
- Fiat stays in regulated accounts (Stripe, banks) → less regulatory risk
- Backend coordinates conversions → easier debugging
- Can upgrade to full Web3 later without changing UI

**Trade-offs:**
- ✅ Faster to build and test
- ✅ Easier to debug (can see all state in PostgreSQL)
- ✅ No gas fees in sandbox
- ❌ Not "pure" Web3 (blockchain is proof layer, not data layer)
- ❌ Requires trusted backend (not fully decentralized)

---

### 2. LLM-Based Orchestrator vs Hardcoded Rules

**Decision:** Replace hardcoded if/elif with LLM reasoning

**Rationale:**
- Market synthesis generates rich, nuanced thesis (e.g., "bullish on rates but bearish on politics for 2 weeks")
- Hardcoded rules can't capture complex interactions between multiple risk factors
- LLM can adapt to new scenarios without code changes
- Structured outputs (Pydantic) prevent hallucination and ensure valid JSON

**Implementation:**
- Use Gemini 2.0 Flash Exp for speed + structured outputs
- Provide full market context (thesis, confidence, risk flags, metrics)
- Include bill details (amount, due date, predicted vs actual)
- Request specific format: `{decisions: [...], selected_route_alert: "..."}`
- Graceful fallback to simple rules if LLM fails

---

### 3. Double-Entry Accounting (Transaction Ledger)

**Decision:** Create separate Transaction table instead of just updating balances

**Rationale:**
- Simple balance columns lose history (can't audit "who changed what when")
- Transaction ledger provides complete audit trail
- Each balance change creates immutable record
- Matches accounting best practices (debits and credits)
- Enables financial reports (monthly spending, category analysis, etc.)

**Schema Design:**
- Every transaction stores both amount changes AND balances after
- External IDs link to Stripe, Stellar, Circle for verification
- Status field tracks pending/completed/failed states
- Description field for human readability

---

### 4. Timestamp Provenance in Audit Hash

**Decision:** Include `fetched_at` in blockchain hash

**Rationale (from conversation.md feedback):**
- Can't prove data was fresh when decision was made
- Scenario: Agent makes BULLISH call at 10am based on data from 8am, but market crashed at 9:30am
- Without timestamp, can't detect this in audit trail
- Including `fetched_at` in hash proves "decision made on data collected at X time"

**Implementation:**
- Researchers generate `fetched_at` when gathering data
- Flows through MarketAnalysis → trust_engine_node
- Included in SHA256 hash alongside decision and metrics
- Stored in AuditLog for semantic search filtering

---

### 5. Stellar Testnet vs Mainnet

**Decision:** Use Stellar testnet exclusively for sandbox

**Rationale:**
- No real money at risk during development
- Friendbot provides free testnet XLM for transactions
- Mock-BRZ is custom asset we control (mint/burn at will)
- USDC testnet exists for realistic simulations
- Can reset accounts and retry without cost

**Mainnet Migration Path:**
- Replace testnet URLs with mainnet URLs
- Use real BRZ stablecoin (issued by Mercado Bitcoin)
- Use production Circle API keys
- Add KYC/AML verification before first withdrawal
- Implement proper key management (not storing secrets in .env)

---

## 🚨 Security Considerations

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

## 📚 API Documentation

After implementation, all endpoints will be documented at:

**Swagger UI:** `http://localhost:8000/docs`
**ReDoc:** `http://localhost:8000/redoc`

### New Endpoints:

**Webhooks:**
- `POST /webhooks/stripe` - Handle Stripe payment webhooks (BRL deposits)

**Payments:**
- `POST /payments/settle` - Execute end-to-end stablecoin payment flow
  - Request: `{username, liability_id, stellar_public_key?}`
  - Response: `{status, stellar_tx_ids, circle_transfer_id, balances}`

**Balances:**
- `GET /balances/{username}` - Get user's current BRL/USD balances
- `GET /balances/{username}/history` - Get transaction history with pagination

**Blockchain (already exists, unchanged):**
- `GET /blockchain/verify/{identifier}` - Verify decision by hash or Stellar TX ID
- `GET /blockchain/search/similar` - Semantic search for similar decisions
- `GET /blockchain/search/contradictions` - Detect contradictory decisions

---

## ⏱️ Timeline Summary

### Phase 1: Agentic Brain Upgrade
- **Step 1.1:** Fix state schema (30 min)
- **Step 1.2:** Add timestamp provenance (15 min)
- **Step 1.3:** LLM orchestrator (1.5-2 hours)
- **Step 1.4:** Trust Engine audit (30 min)
- **Total:** 3-4 hours

### Phase 2: Stablecoin Sandbox
- **Step 2.1:** Database schema + migration (1 hour)
- **Step 2.2:** Stripe webhook handler (1.5 hours)
- **Step 2.3:** Stellar testnet tools (2 hours)
- **Step 2.4:** Circle sandbox integration (1 hour)
- **Step 2.5:** Settlement flow + email (1.5 hours)
- **Total:** 4-6 hours

### Phase 3: Route Polish
- **Step 3.1:** Balance endpoints (30 min)
- **Total:** 30 minutes

### **Grand Total:** 8-12 hours

---

## ✅ Success Criteria

### Functional Requirements:
- [ ] User can deposit BRL via Stripe Test Mode
- [ ] Agent provides intelligent pay/wait recommendations using LLM
- [ ] Full stablecoin flow executes (BRL → Mock-BRZ → USDC → USD)
- [ ] All transaction IDs are returned and verifiable
- [ ] Database balances are accurate with audit trail
- [ ] Email receipts include blockchain links
- [ ] Semantic search can find similar decisions
- [ ] Timestamp provenance is in audit hash

### Technical Requirements:
- [ ] All async operations complete without blocking
- [ ] Type safety with Pydantic and TypedDict
- [ ] Graceful error handling (LLM fallback, API retries)
- [ ] Database migrations applied cleanly
- [ ] No secrets in git (all in .env)
- [ ] API docs are up-to-date

### User Experience:
- [ ] Payment flow completes in <10 seconds
- [ ] Clear error messages if insufficient balance
- [ ] Email receipt arrives within 1 minute
- [ ] Blockchain verification works on Stellar Explorer
- [ ] UI shows real-time balance updates (future)

---

## 🔄 Future Enhancements

### Short-Term (Next Sprint):
1. **Frontend Integration**:
   - Balance display widget
   - "Pay Now" button that calls `/payments/settle`
   - Transaction history table with Stellar links

2. **Testing**:
   - Unit tests for all new endpoints
   - Integration tests for full payment flow
   - Load testing (100 concurrent payments)

3. **Monitoring**:
   - Prometheus metrics for payment success rate
   - Grafana dashboard for balance changes over time
   - Sentry for error tracking

### Medium-Term (Next Quarter):
1. **Production Migration**:
   - Mainnet Stellar integration
   - Real BRZ stablecoin (Mercado Bitcoin partnership)
   - Circle production API
   - KYC/AML verification flow

2. **Advanced Features**:
   - Recurring payments (auto-pay tuition monthly)
   - Payment scheduling (pay when rate hits target)
   - Multi-currency support (USD, EUR, GBP)
   - Payment splitting (multiple bills in one transaction)

3. **Risk Management**:
   - Volatility alerts (FX moved >2% today)
   - Smart alerts (BEARISH signal but bill due tomorrow)
   - Historical performance tracking (how much saved)

### Long-Term (6-12 Months):
1. **Full Web3 Migration**:
   - Remove backend as trusted intermediary
   - User-controlled wallets (MetaMask, Phantom)
   - Smart contracts for payment automation
   - DAI/USDC/USDT support

2. **DeFi Integration**:
   - Yield farming on idle balances
   - Flash loans for instant liquidity
   - Liquidity pool participation

3. **Regulatory Compliance**:
   - Money transmitter licenses (state by state)
   - SOC 2 Type II audit
   - Insurance fund for smart contract risks

---

## 📖 References & Resources

### Documentation Read:
- **conversation.md** (1021 lines): Full context of stablecoin integration discussion
- **MIGRATION_COMPLETE.md**: Phase 6 semantic search implementation details
- **MIGRATION_LOG.md**: Historical context of infrastructure upgrades

### External Resources:
- **Stellar Docs**: https://developers.stellar.org/docs
- **Circle API**: https://developers.circle.com/docs/sandbox
- **Stripe Webhooks**: https://stripe.com/docs/webhooks
- **LangGraph**: https://python.langchain.com/docs/langgraph
- **Gemini Structured Outputs**: https://ai.google.dev/gemini-api/docs/structured-output

### Key Design Patterns:
- **Web2.5 Architecture**: Hybrid blockchain + database approach
- **Double-Entry Accounting**: Transaction ledger best practices
- **LLM Orchestration**: Structured outputs with Pydantic
- **Semantic Search**: pgvector for AI decision analysis

---

## 🎉 Conclusion

This plan addresses **all concerns raised in conversation.md** and provides a complete implementation roadmap for the stablecoin integration + agentic brain upgrades.

### What Gets Fixed:
1. ✅ **State Schema Brittleness** → Typed MarketMetrics
2. ✅ **Missing Timestamp Provenance** → fetched_at in audit hash
3. ✅ **Orchestrator Bottleneck** → LLM-based reasoning
4. ✅ **Audit Completeness** → Full data freshness tracking
5. ✅ **No Stablecoin Support** → Complete Web2.5 sandbox

### What Gets Built:
- Complete stablecoin flow: BRL → Mock-BRZ → USDC → USD
- Stripe Test Mode integration for deposits
- Stellar Testnet tools for blockchain operations
- Circle Sandbox for fiat off-ramp
- Transaction ledger with full audit trail
- Email receipts with blockchain verification

### Estimated Timeline:
- **Phase 1 (Brain Fixes):** 3-4 hours
- **Phase 2 (Stablecoins):** 4-6 hours
- **Phase 3 (Polish):** 30 minutes
- **Total:** 8-12 hours

**This plan is ready for implementation by you or another LLM.**

---

**Next Steps:**
1. Review this plan with the team
2. Set up test accounts (Stripe, Circle, Stellar)
3. Start with Phase 1 (lower risk, architectural fixes)
4. Then proceed to Phase 2 (stablecoin sandbox)
5. Test end-to-end with the provided test scenario
6. Deploy to staging for team demo

**Questions? Issues? Contact the author of this plan or open a GitHub issue.**

🚀 **Ready to transform Revellio from prototype to production-ready stablecoin platform!**


---

# 🔧 UPDATE: Phase 2.1 — Stripe-Ready Financial Architecture

## Goal
Introduce a proper financial model that separates:
- **State (wallet)**
- **Intent (checkout)**
- **History (transactions)**

---

## 🧱 New Core Tables

### Wallet (Current State)

```python
class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, ForeignKey("users.username"), unique=True, nullable=False, index=True)

    brl_available = Column(Float, nullable=False, default=0.0)
    usd_available = Column(Float, nullable=False, default=0.0)

    brl_pending = Column(Float, nullable=False, default=0.0)

    total_deposited_brl = Column(Float, nullable=False, default=0.0)
    total_spent_brl = Column(Float, nullable=False, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

---

### Checkout (Stripe Lifecycle)

```python
class Checkout(Base):
    __tablename__ = "checkouts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, ForeignKey("users.username"), nullable=False, index=True)

    provider = Column(String, default="stripe")
    purpose = Column(String, default="wallet_topup")

    status = Column(String, nullable=False, default="created")

    currency = Column(String, nullable=False, default="BRL")
    amount = Column(Float, nullable=False)

    stripe_checkout_session_id = Column(String, unique=True, nullable=True, index=True)
    stripe_payment_intent_id = Column(String, unique=True, nullable=True, index=True)

    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
```

---

### Transactions (Ledger)

```python
class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, ForeignKey("users.username"), nullable=False, index=True)

    wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=True)
    checkout_id = Column(Integer, ForeignKey("checkouts.id"), nullable=True)
    liability_id = Column(Integer, ForeignKey("liabilities.id"), nullable=True)

    transaction_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="completed")

    asset = Column(String, nullable=False)
    direction = Column(String, nullable=False)
    amount = Column(Float, nullable=False)

    balance_before = Column(Float, nullable=True)
    balance_after = Column(Float, nullable=True)

    stripe_event_id = Column(String, nullable=True)
    stripe_payment_intent_id = Column(String, nullable=True)

    description = Column(String, nullable=False)
    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

---

## 🔄 Updated Stripe Flow

1. Create Checkout → store Stripe IDs  
2. Stripe webhook fires  
3. Update Wallet balance  
4. Insert Transaction record  
5. Mark Checkout as completed  

---

## 🧠 Financial System Principles

1. Wallet = current state  
2. Transactions = immutable history  
3. Checkout = external lifecycle  
4. Webhooks must be idempotent  
5. Never update balance without a transaction  

---

## 🔥 Hackathon Simplification

Minimum viable version:
- wallet.brl_available  
- checkout  
- transactions  

---

