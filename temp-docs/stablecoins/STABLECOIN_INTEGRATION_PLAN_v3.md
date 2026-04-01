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

**Implementation:**
Replace `metrics: Dict[str, Any]` with a proper `MarketMetrics` TypedDict that matches the structure produced by `synthesis_node` (researchers.py:526-534).

Add `fetched_at: str` field to `MarketAnalysis` TypedDict to capture data freshness timestamp.

**Testing:**
```bash
cd src/server
python -m mypy agents/state.py
docker-compose exec backend python -m agents.graph
```

---

### Step 1.2: Add Timestamp Provenance (state.py + researchers.py + trust.py)

**Goal:** Flow `fetched_at` through the entire pipeline and include in audit hash

**Files to Modify:**
- `src/server/agents/state.py` (add `fetched_at` field to `MarketAnalysis`)
- `src/server/agents/researchers.py` (ensure `fetched_at` is set in synthesis output)
- `src/server/agents/trust.py` (include `fetched_at` in decision_payload)

**Implementation:**
1. Update `MarketAnalysis` TypedDict to include `fetched_at: str`
2. Modify `synthesis_node` to set `fetched_at` in the returned MarketAnalysis
3. Modify `trust_engine_node` to include `fetched_at` in the hashed payload

**Testing:**
```bash
# Trigger a decision and verify the audit_log includes fetched_at
curl -X POST http://localhost:8000/agent/recommendation \
  -H "Content-Type: application/json" \
  -d '{"username": "cbahlis", "liability_id": 1}'

# Check the audit_log
psql $DATABASE_URL -c "SELECT reasoning FROM audit_log ORDER BY timestamp DESC LIMIT 1;"
```

---

### Step 1.3: Replace Orchestrator with LLM Reasoning (orchestrator.py)

**Goal:** Replace 45 lines of hardcoded if/elif rules with LLM-based decision making

**Files to Modify:**
- `src/server/agents/orchestrator.py`

**Implementation:**
Replace the rigid rule-based logic with a Gemini call that:
- Takes the `thesis`, `prediction`, `confidence`, `risk_flags` as context
- Takes the bill details (`due_date`, `amount`, `name`)
- Outputs a structured decision: `{"pay_now": bool, "reason": str}`

**Why This Matters:**
- Can handle nuanced scenarios like "Bullish on rates but bearish on politics for next 2 weeks"
- Adapts to new market conditions without code changes
- Leverages the full intelligence of the market synthesis

**Testing:**
```bash
# Test various scenarios
curl -X POST http://localhost:8000/agent/recommendation \
  -H "Content-Type: application/json" \
  -d '{"username": "cbahlis", "liability_id": 1}'
```

---

### Step 1.4: Verify Audit Completeness (trust.py + blockchain.py)

**Goal:** Ensure blockchain audit includes all relevant provenance data

**Files to Verify:**
- `src/server/agents/trust.py` (verify `fetched_at` is in hashed payload)
- `src/server/my_fastapi_app/app/routes/blockchain.py` (verify `/blockchain/verify` returns fetched_at)

**Testing:**
```bash
# Make a decision, get the decision_hash
curl -X POST http://localhost:8000/agent/recommendation \
  -H "Content-Type: application/json" \
  -d '{"username": "cbahlis", "liability_id": 1}'

# Verify the decision on blockchain
curl http://localhost:8000/blockchain/verify/{decision_hash}
```

---

## 📦 Phase 2: Stablecoin Sandbox Implementation

**Duration:** 4-6 hours
**Priority:** MEDIUM (enables demo of full stablecoin flow)
**Status:** 🔄 PARTIALLY COMPLETE (Steps 2.1-2.2 done, Steps 2.3-2.5 remaining)

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

**Environment Variables Needed:**
```bash
CIRCLE_API_KEY=...
CIRCLE_USDC_HOT_WALLET=G...  # Revellio's USDC custody wallet
CIRCLE_API_URL=https://api-sandbox.circle.com
```

**Testing:**
```python
transfer_id = initiate_usdc_withdrawal(
    amount_usd=1000.0,
    recipient_account={
        "accountNumber": "1234567890",
        "routingNumber": "021000021",
        "bankName": "Test University"
    },
    metadata={"username": "cbahlis", "liability_id": 1}
)

# Poll status
status = check_transfer_status(transfer_id)
print(f"Transfer {transfer_id}: {status}")
```

**Resources:**
- Circle API Docs: https://developers.circle.com/docs/sandbox
- Circle requires KYB for production

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
