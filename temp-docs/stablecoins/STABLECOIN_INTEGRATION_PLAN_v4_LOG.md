# Stablecoin Integration Plan v4 - Execution Log

**Plan File:** `/temp-docs/stablecoins/STABLECOIN_INTEGRATION_PLAN_v4.md`
**Started:** 2026-04-01
**Status:** 🔄 IN PROGRESS

---

## Overview

This log tracks the implementation of Phase 1 (Agentic Brain Upgrade) and Phase 2 (Stablecoin Sandbox) following the detailed plan in `STABLECOIN_INTEGRATION_PLAN_v4.md`.

### Phase Status:
- **Phase 1 (Agentic Brain)**: 🔄 IN PROGRESS
  - Step 1.1: Fix State Schema - STARTING NOW
  - Step 1.2: Add Timestamp Provenance - PENDING
  - Step 1.3: Replace Orchestrator with LLM - PENDING
  - Step 1.4: Update Trust Engine Audit Hash - PENDING

- **Phase 2 (Stablecoin Sandbox)**: 🔄 PARTIALLY COMPLETE
  - Step 2.1: Database Schema ✅ DONE (by teammate)
  - Step 2.2: Stripe Webhooks ✅ DONE (by teammate)
  - Step 2.3: Stellar Testnet Tools - PENDING
  - Step 2.4: Circle Sandbox - PENDING
  - Step 2.5: Settlement Flow - PENDING

---

## Session 1: 2026-04-01 - Phase 1 Step 1.1

### Step 1.1: Fix State Schema (state.py)

**Goal:** Replace loose `Dict[str, Any]` with strongly-typed `MarketMetrics`

**Estimated Time:** 30 minutes
**Started:** 2026-04-01

#### Pre-Implementation Analysis

**Current state.py structure (lines 1-9):**
```python
from typing import TypedDict, List, Optional, Dict, Any, Annotated

class MarketAnalysis(TypedDict):
    prediction: str # "BULLISH" | "BEARISH" | "NEUTRAL"
    confidence: float # 0.0 to 1.0
    thesis: str # 2 to 3 sentence explanation of "why."
    metrics: Dict[str, Any] # Hard numbers: selic, fed_rate, rsi, commodity deltas, etc.
    risk_flags: List[str] # e.g. ["election_volatility", "commodity_headwind", "geopolitical_risk"]
```

**Issues identified:**
1. ❌ `metrics: Dict[str, Any]` - No type safety, allows any structure
2. ❌ Missing `fetched_at` timestamp field for audit provenance
3. ❌ No defined structure for what metrics should contain

**Plan:**
1. Add `MarketMetrics` TypedDict with all expected fields
2. Update `MarketAnalysis.metrics` to use `MarketMetrics` type
3. Add `fetched_at: str` field to `MarketAnalysis`

#### Implementation

**Modified:** `src/server/agents/state.py`

**Changes made:**
1. ✅ Added `MarketMetrics` TypedDict class (lines 7-33)
   - Macro indicators: selic_rate, fed_funds_rate, rate_differential, focus_ipca_12m, focus_selic_eoy, us_cpi_yoy, yield_curve_10y2y, brazil_gdp_growth, usa_gdp_growth
   - Commodity indicators: commodity_sentiment, oil_price, soy_price, iron_price
   - Sentiment indicators: fiscal_health_score, geopolitical_risk_score, political_stability_score
   - All fields are `Optional` to handle missing data gracefully
   - Used `total=False` to allow partial dictionaries

2. ✅ Updated `MarketAnalysis` TypedDict (lines 36-47)
   - Changed `metrics: Dict[str, Any]` → `metrics: MarketMetrics`
   - Added `fetched_at: str` field for timestamp provenance
   - Added comprehensive docstring

**New code structure:**
```python
class MarketMetrics(TypedDict, total=False):
    """Typed market metrics structure..."""
    selic_rate: Optional[float]
    fed_funds_rate: Optional[float]
    # ... all 14 metric fields ...

class MarketAnalysis(TypedDict):
    """Structured market analysis output..."""
    prediction: str
    confidence: float
    thesis: str
    metrics: MarketMetrics  # ← Strongly typed
    risk_flags: List[str]
    fetched_at: str  # ← New field for audit
```

**Benefits:**
- ✅ Type safety: mypy and IDEs can now validate metric access
- ✅ Autocomplete: Developers get field suggestions
- ✅ Documentation: Clear structure for what metrics exist
- ✅ Audit trail: `fetched_at` enables data freshness tracking

#### Testing

**Manual verification needed (Python not available in my environment):**

Please run these commands to verify Step 1.1:

```bash
# 1. Verify syntax
cd src/server
python3 -m py_compile agents/state.py

# 2. (Optional) Type check with mypy if installed
python3 -m mypy agents/state.py

# 3. Check that the file imports correctly
python3 -c "from agents.state import MarketMetrics, MarketAnalysis; print('✓ Import successful')"
```

**Expected result:** No errors, clean import

#### Step 1.1 Status: ✅ CODE COMPLETE - AWAITING USER VERIFICATION

**Files modified:**
- `src/server/agents/state.py` (added MarketMetrics TypedDict, updated MarketAnalysis)

**Next step:** Step 1.2 - Add Timestamp Provenance Flow

---

### Step 1.2: Add Timestamp Provenance Flow

**Goal:** Ensure `fetched_at` timestamp flows from researchers → synthesis → trust engine

**Estimated Time:** 15 minutes
**Started:** 2026-04-01

#### Pre-Implementation Analysis

**Current researchers.py structure:**
- Line 15: `datetime` already imported ✅
- Line 564-570: LLM synthesis creates `market_analysis` dict (missing `fetched_at`)
- Line 613-625: Fallback analysis creates `market_analysis` dict (missing `fetched_at`)

**Changes needed:**
1. Add `"fetched_at": datetime.now().isoformat()` to LLM synthesis output (line ~570)
2. Add `"fetched_at": datetime.now().isoformat()` to fallback output (line ~625)

#### Implementation

**Modified:** `src/server/agents/researchers.py`

**Changes made:**

1. ✅ Added `fetched_at` to LLM synthesis output (line 570)
   ```python
   market_analysis = {
       "prediction": prediction,
       "confidence": confidence,
       "thesis": analysis.get("thesis", "No thesis generated."),
       "metrics": analysis.get("metrics", {}),
       "risk_flags": analysis.get("risk_flags", []),
       "fetched_at": datetime.now().isoformat()  # ← NEW
   }
   ```

2. ✅ Added `fetched_at` to fallback analysis output (line 625)
   ```python
   market_analysis = {
       "prediction": prediction,
       "confidence": confidence,
       "thesis": thesis,
       "metrics": { ... },
       "risk_flags": risk_flags,
       "fetched_at": datetime.now().isoformat()  # ← NEW
   }
   ```

**Benefits:**
- ✅ Timestamp now flows through the entire pipeline
- ✅ Trust Engine can hash data freshness
- ✅ Audit trail shows when market data was collected
- ✅ Can detect stale data issues during debugging

#### Testing

**Manual verification needed:**

```bash
cd src/server
python3 -m py_compile agents/researchers.py
```

**Expected:** No syntax errors

#### Step 1.2 Status: ✅ CODE COMPLETE - AWAITING USER VERIFICATION

**Files modified:**
- `src/server/agents/researchers.py` (added fetched_at to market_analysis in 2 places)

**Next step:** Step 1.3 - Replace Orchestrator with LLM Reasoning

---

### Step 1.3: Replace Orchestrator with LLM Reasoning

**Goal:** Replace 45 lines of if/elif rules with LLM-based decision making

**Estimated Time:** 1.5-2 hours
**Started:** 2026-04-01

#### Pre-Implementation Analysis

**Current orchestrator.py structure (144 lines):**
- Lines 58-103: 45 lines of hardcoded if/elif rules ❌
- Simple logic: URGENT → pay, BULLISH → pay, BEARISH → wait
- Cannot parse nuanced thesis like "bullish on rates but bearish on politics"
- Adding new rules requires code changes

**Plan from v4:**
- Replace rules with Gemini API call using structured outputs
- Use Pydantic schemas for type safety (`BillDecision`, `OrchestratorOutput`)
- Pass full context: thesis, metrics, risk_flags, bill details
- Implement graceful fallback if LLM fails

#### Implementation

**Modified:** `src/server/agents/orchestrator.py`

**Complete rewrite from 144 lines → 272 lines:**

**1. ✅ Added Pydantic Schemas (lines 17-29)**
```python
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
```

**2. ✅ Added New Imports (lines 6-10)**
```python
from pydantic import BaseModel, Field
from typing import List
from google import genai
from my_fastapi_app.app.settings import settings
import json
```

**3. ✅ Rewrote orchestrator_node Function (lines 36-271)**

**Key changes:**

**a) Enhanced Market Context Extraction (lines 61-71)**
- Now extracts `fetched_at` timestamp for audit trail
- Extracts full `metrics` dict for detailed LLM prompt
- Logs data freshness: `Data Fetched: {fetched_at}`

**b) Bill Summary Preparation (lines 74-91)**
- Creates structured bill data for LLM prompt
- Includes: id, name, amount_usd, days_until_due, is_predicted, cost_estimate_brl
- Enables LLM to reason about each bill individually

**c) Comprehensive LLM Prompt (lines 94-154)**
- **Market Analysis Section:** Prediction, confidence, thesis, risk flags, key metrics (Selic, Fed Funds, commodity sentiment, fiscal health, political stability)
- **Bill Details:** All unpaid bills with amounts, due dates, estimated BRL cost
- **Decision Framework:** Clear PAY NOW vs WAIT criteria
  - PAY NOW: Urgent (≤3 days), strong BULLISH (≥0.7), moderate BULLISH + deadline, NEUTRAL + imminent
  - WAIT: BEARISH signal, high-risk flags, low confidence, predicted bills
- **Important Notes:** URGENCY OVERRIDES EVERYTHING, use THESIS not just prediction, consider specific risk flags

**d) Gemini API Call with Structured Output (lines 157-212)**
```python
gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)

response = gemini_client.models.generate_content(
    model="gemini-2.0-flash-exp",
    contents=[prompt],
    config=genai.types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=OrchestratorOutput  # ← Pydantic schema ensures valid JSON
    )
)
```
- Parses JSON response and converts to internal format
- Validates bill IDs to prevent hallucinated decisions
- Includes confidence and risk_flags in each decision record

**e) Graceful Fallback (lines 218-271)**
- If LLM fails (API error, timeout, invalid response), falls back to simple rules
- Ultra-simple logic: urgent → pay, strong BULLISH → pay, BEARISH → wait, due soon → pay, else → wait
- Ensures system never completely fails, just degrades to basic rule-based logic

**Before (Old Code - 45 lines of if/elif rules):**
```python
# Lines 58-103 (OLD VERSION - REMOVED)
if days_until_due <= 3:
    pay_now = True
    reason = f"URGENT: {bill.name} is due in {max(0, days_until_due)} days..."
elif "fiscal_concerns" in risk_flags and confidence < 0.6:
    pay_now = False
    reason = f"Fiscal instability detected..."
elif "election_volatility" in risk_flags and days_until_due > 7:
    pay_now = False
    reason = "Election volatility detected..."
elif "yield_curve_inversion" in risk_flags:
    pay_now = False
    reason = "US yield curve inverted..."
elif prediction == "BULLISH" and confidence >= 0.7:
    pay_now = True
    reason = f"Strong BULLISH signal..."
# ... 30+ more lines of elif branches
```

**After (New Code - LLM-powered reasoning):**
```python
# Lines 157-212 (NEW VERSION)
# Build comprehensive prompt with market thesis, metrics, risk flags, bill details
# Call Gemini with structured output schema
# LLM reasons about each bill individually, considering:
#   - Market thesis nuance (not just binary prediction)
#   - Specific risk flags
#   - Bill urgency
#   - Confidence levels
# Returns structured decisions with explanations
```

**Benefits:**
- ✅ **Flexible Reasoning:** Can understand complex market narratives ("bullish on rates but bearish on politics")
- ✅ **Individual Bill Context:** Each decision considers specific bill deadline + market conditions
- ✅ **Structured Output:** Pydantic ensures valid JSON, no parsing errors
- ✅ **Graceful Degradation:** Falls back to simple rules if LLM fails
- ✅ **Audit Trail:** Decisions include confidence, risk_flags, data freshness for analysis
- ✅ **No Code Changes:** New market factors automatically considered by LLM (vs adding elif branches)

#### Testing

**Manual verification needed:**

```bash
# 1. Verify syntax
cd src/server
python3 -m py_compile agents/orchestrator.py

# 2. Check imports work
python3 -c "from agents.orchestrator import orchestrator_node, BillDecision, OrchestratorOutput; print('✓ Import successful')"

# 3. (Optional) Type check if mypy installed
python3 -m mypy agents/orchestrator.py

# 4. Verify Pydantic schemas can be instantiated
python3 -c "
from agents.orchestrator import BillDecision, OrchestratorOutput
bill_dec = BillDecision(liability_id=1, pay=True, reason='Test reason')
orch_out = OrchestratorOutput(decisions=[bill_dec], selected_route_alert='Test alert')
print('✓ Pydantic schemas valid')
"
```

**Expected result:** No errors, clean imports

**Integration test (requires running backend):**
```bash
# This will actually call the LLM if unpaid bills exist
docker-compose exec backend python -c "
from agents.graph import app
from agents.state import AuraState
import asyncio

async def test():
    result = await app.ainvoke({
        'brl_balance': 10000.0,
        'usd_balance': 1000.0,
        'current_fx_rate': 5.0,
        'pending_liabilities': []
    })
    print('Graph execution:', result.get('selected_route', 'None'))

asyncio.run(test())
"
```

#### Step 1.3 Status: ✅ CODE COMPLETE - AWAITING USER VERIFICATION

**Files modified:**
- `src/server/agents/orchestrator.py` (complete rewrite: 144 lines → 272 lines)

**Changes summary:**
- Added Pydantic schemas: `BillDecision`, `OrchestratorOutput`
- Replaced 45 lines of if/elif rules with Gemini LLM call
- Implemented comprehensive prompt with market thesis + metrics + bill details
- Added structured output parsing with validation
- Implemented graceful fallback to simple rules if LLM fails

**Next step:** Step 1.4 - Update Trust Engine Audit Hash

---

### Step 1.4: Update Trust Engine Audit Hash

**Goal:** Include `fetched_at` timestamp in the decision payload that gets hashed

**Estimated Time:** 30 minutes
**Started:** 2026-04-01

#### Pre-Implementation Analysis

**Current trust.py structure:**
- Lines 33-42: `decision_payload` dict missing `fetched_at` field ❌
- Lines 99-107: Embedding generation missing `fetched_at` in market context ❌
- Audit hash doesn't capture data freshness → can't detect decisions made on stale data

**Issues identified:**
1. ❌ Blockchain hash (SHA256) doesn't include when market data was collected
2. ❌ Semantic search can't filter by data freshness
3. ❌ Can't debug "why did AI make X decision at 10am?" when data was from 8am

**Plan:**
1. Add `"data_fetched_at": market_analysis.get("fetched_at", None)` to decision_payload
2. Add `"data_fetched_at"` to market_context in embedding generation
3. Now audit trail shows both WHAT decision was made and WHEN the data was collected

#### Implementation

**Modified:** `src/server/agents/trust.py`

**Changes made:**

**1. ✅ Added `data_fetched_at` to audit hash payload (line 39)**

```python
# Before:
decision_payload = {
    "market_prediction": market_analysis.get("prediction", state.get("market_prediction")),
    "market_confidence": market_analysis.get("confidence", 0.0),
    "market_thesis": market_analysis.get("thesis", ""),
    "risk_flags": market_analysis.get("risk_flags", []),
    "market_metrics": market_analysis.get("metrics", {}),
    "current_fx_rate": state.get("current_fx_rate"),
    "reasoning": reasoning_text,
    "payment_decisions": state.get("payment_decisions")
}

# After:
decision_payload = {
    "market_prediction": market_analysis.get("prediction", state.get("market_prediction")),
    "market_confidence": market_analysis.get("confidence", 0.0),
    "market_thesis": market_analysis.get("thesis", ""),
    "risk_flags": market_analysis.get("risk_flags", []),
    "market_metrics": market_analysis.get("metrics", {}),
    "data_fetched_at": market_analysis.get("fetched_at", None),  # ← NEW: Phase 1 Step 1.4
    "current_fx_rate": state.get("current_fx_rate"),
    "reasoning": reasoning_text,
    "payment_decisions": state.get("payment_decisions")
}
```

**2. ✅ Added `data_fetched_at` to semantic embedding context (line 106)**

```python
# Before:
reasoning_embedding = generate_reasoning_embedding(
    reasoning_text=reasoning_text,
    market_context={
        "prediction": decision_payload["market_prediction"],
        "confidence": decision_payload["market_confidence"],
        "thesis": decision_payload["market_thesis"],
        "risk_flags": decision_payload["risk_flags"]
    }
)

# After:
reasoning_embedding = generate_reasoning_embedding(
    reasoning_text=reasoning_text,
    market_context={
        "prediction": decision_payload["market_prediction"],
        "confidence": decision_payload["market_confidence"],
        "thesis": decision_payload["market_thesis"],
        "risk_flags": decision_payload["risk_flags"],
        "data_fetched_at": decision_payload["data_fetched_at"]  # ← NEW: Phase 1 Step 1.4
    }
)
```

**Benefits:**
- ✅ **Blockchain Audit:** SHA256 hash now includes when market data was collected
- ✅ **Temporal Traceability:** Can verify decisions weren't made on stale data
- ✅ **Semantic Search:** Can query "show me decisions made on data >2 hours old"
- ✅ **Debugging:** Can trace back when bad decisions happened due to outdated conditions
- ✅ **Audit Compliance:** Complete provenance chain from data collection → decision → hash

**Example:**
- Old hash: `sha256({"prediction": "BULLISH", "confidence": 0.8, ...})`
- New hash: `sha256({"prediction": "BULLISH", "confidence": 0.8, "data_fetched_at": "2026-04-01T14:30:00", ...})`
- Now if market conditions changed at 14:45 but decision used 14:30 data, we can detect this!

#### Testing

**Manual verification needed:**

```bash
# 1. Verify syntax
cd src/server
python3 -m py_compile agents/trust.py

# 2. Check imports work
python3 -c "from agents.trust import trust_engine_node; print('✓ Import successful')"

# 3. (Optional) Verify hash changes with different timestamps
python3 -c "
import hashlib
import json

# Same decision, different timestamps → different hashes
payload1 = {'prediction': 'BULLISH', 'confidence': 0.8, 'data_fetched_at': '2026-04-01T10:00:00'}
payload2 = {'prediction': 'BULLISH', 'confidence': 0.8, 'data_fetched_at': '2026-04-01T10:01:00'}

hash1 = hashlib.sha256(json.dumps(payload1, sort_keys=True).encode()).hexdigest()
hash2 = hashlib.sha256(json.dumps(payload2, sort_keys=True).encode()).hexdigest()

print(f'Hash 1: {hash1[:16]}...')
print(f'Hash 2: {hash2[:16]}...')
print(f'Hashes differ: {hash1 != hash2}')
"
```

**Expected result:** Hashes differ even with same prediction, proving timestamp is included

#### Step 1.4 Status: ✅ CODE COMPLETE - AWAITING USER VERIFICATION

**Files modified:**
- `src/server/agents/trust.py` (added data_fetched_at to decision_payload and embedding context)

**Changes summary:**
- Added `data_fetched_at` field to decision_payload (line 39)
- Added `data_fetched_at` to semantic embedding market_context (line 106)
- Audit hash now includes timestamp provenance for complete traceability

---

## 🎉 Phase 1 Complete: Agentic Brain Upgrade

**Total Duration:** ~3 hours
**Status:** ✅ ALL STEPS COMPLETE - AWAITING USER VERIFICATION

### Summary of Changes

**Files Modified:**
1. ✅ `src/server/agents/state.py` - Added MarketMetrics TypedDict, updated MarketAnalysis with fetched_at
2. ✅ `src/server/agents/researchers.py` - Added timestamp to market_analysis output (2 locations)
3. ✅ `src/server/agents/orchestrator.py` - Complete rewrite: 144 lines → 272 lines with LLM reasoning
4. ✅ `src/server/agents/trust.py` - Added data_fetched_at to audit hash and embeddings

### What Was Achieved

**1. Type Safety (Step 1.1)**
- Replaced loose `Dict[str, Any]` with strongly-typed `MarketMetrics`
- Added 14 specific metric fields with proper types
- IDE autocomplete and mypy validation now available

**2. Timestamp Provenance (Step 1.2)**
- Added `fetched_at` field to MarketAnalysis
- Timestamp flows from researchers → synthesis → orchestrator → trust engine
- Can now track data freshness throughout the pipeline

**3. LLM Orchestration (Step 1.3)**
- Replaced 45 lines of if/elif rules with Gemini-powered reasoning
- LLM can understand nuanced market narratives
- Pydantic schemas ensure structured outputs
- Graceful fallback to simple rules if LLM fails

**4. Complete Audit Trail (Step 1.4)**
- Blockchain hash (SHA256) now includes data collection timestamp
- Semantic search can filter by data freshness
- Complete provenance from market data → decision → immutable proof

### User Verification Checklist

Please run these commands to verify Phase 1 implementation:

```bash
cd src/server

# 1. Verify all files compile
python3 -m py_compile agents/state.py
python3 -m py_compile agents/researchers.py
python3 -m py_compile agents/orchestrator.py
python3 -m py_compile agents/trust.py

# 2. Check imports work
python3 -c "from agents.state import MarketMetrics, MarketAnalysis; print('✓ state.py imports OK')"
python3 -c "from agents.researchers import market_synthesis_node; print('✓ researchers.py imports OK')"
python3 -c "from agents.orchestrator import orchestrator_node, BillDecision, OrchestratorOutput; print('✓ orchestrator.py imports OK')"
python3 -c "from agents.trust import trust_engine_node; print('✓ trust.py imports OK')"

# 3. (Optional) Type check if mypy installed
python3 -m mypy agents/state.py
python3 -m mypy agents/orchestrator.py
python3 -m mypy agents/trust.py
```

**Expected result:** All imports succeed with no errors

### Next Steps

**Phase 2: Stablecoin Sandbox** (remaining work)
- ✅ Step 2.1: Database Schema (done by teammate)
- ✅ Step 2.2: Stripe Webhooks (done by teammate)
- ⏸️ Step 2.3: Stellar Testnet Tools - PENDING
- ⏸️ Step 2.4: Circle Sandbox Integration - PENDING
- ⏸️ Step 2.5: Settlement Flow + Email Notifications - PENDING

**Awaiting user instruction:** Should we proceed with Phase 2 Step 2.3 (Stellar Testnet Tools)?

---
