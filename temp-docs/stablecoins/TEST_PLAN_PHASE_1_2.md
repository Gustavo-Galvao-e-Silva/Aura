# Testing Plan: Phase 1 + Phase 2 (Steps 2.1-2.4)

**Date:** 2026-04-01
**Purpose:** Verify all implementations work before proceeding to Step 2.5

---

## Test 1: Phase 1 - Agent System Verification

### 1.1 Verify Python Syntax

```bash
cd src/server

# Test all modified files compile
python3 -m py_compile agents/state.py
python3 -m py_compile agents/researchers.py
python3 -m py_compile agents/orchestrator.py
python3 -m py_compile agents/trust.py

echo "✓ All Phase 1 files compile successfully"
```

**Expected:** No errors

---

### 1.2 Verify Imports

```bash
# Test state.py
python3 -c "
from agents.state import MarketMetrics, MarketAnalysis, AuraState
print('✓ state.py imports OK')
print(f'  MarketMetrics fields: {MarketMetrics.__annotations__.keys()}')
print(f'  MarketAnalysis has fetched_at: {\"fetched_at\" in MarketAnalysis.__annotations__}')
"

# Test orchestrator.py
python3 -c "
from agents.orchestrator import orchestrator_node, BillDecision, OrchestratorOutput
print('✓ orchestrator.py imports OK')
print(f'  BillDecision fields: {BillDecision.__annotations__.keys()}')
"

# Test trust.py
python3 -c "
from agents.trust import trust_engine_node
print('✓ trust.py imports OK')
"
```

**Expected output:**
```
✓ state.py imports OK
  MarketMetrics fields: dict_keys([...])
  MarketAnalysis has fetched_at: True
✓ orchestrator.py imports OK
  BillDecision fields: dict_keys(['liability_id', 'pay', 'reason'])
✓ trust.py imports OK
```

---

### 1.3 Test Orchestrator LLM Schema

```bash
python3 -c "
from agents.orchestrator import BillDecision, OrchestratorOutput

# Test Pydantic schemas can be instantiated
bill = BillDecision(liability_id=1, pay=True, reason='Test reason')
output = OrchestratorOutput(
    decisions=[bill],
    selected_route_alert='Test alert'
)

print('✓ Pydantic schemas valid')
print(f'  Bill: {bill.model_dump()}')
print(f'  Output: {output.model_dump()}')
"
```

**Expected:** Pydantic models instantiate without errors

---

## Test 2: Phase 2.1-2.2 - Database & Stripe

### 2.1 Verify Database Tables Exist

```bash
# Check migration status
cd src/server
alembic current

# Should show: 770d3084524c (head)
```

**Expected:** Migration `770d3084524c` applied

---

### 2.2 Query Database Tables

```bash
# Test database connection and table structure
python3 -c "
import asyncio
from sqlalchemy import select, inspect
from my_fastapi_app.app.db.session import AsyncSessionLocal, engine
from db.models import Wallet, Checkout, Transaction, Liability

async def test():
    # Check tables exist
    async with engine.begin() as conn:
        inspector = inspect(engine.sync_engine)
        tables = inspector.get_table_names()

        print('Database tables:')
        for table in ['wallets', 'checkouts', 'transactions', 'liabilities']:
            exists = table in tables
            print(f'  {table}: {\"✓\" if exists else \"✗\"}')

    # Test wallet operations
    async with AsyncSessionLocal() as db:
        # Check if test user has wallet
        result = await db.execute(
            select(Wallet).limit(1)
        )
        wallet = result.scalar_one_or_none()

        if wallet:
            print(f'\\n✓ Sample wallet found:')
            print(f'  Username: {wallet.username}')
            print(f'  BRL: R${wallet.brl_available:.2f}')
            print(f'  USD: ${wallet.usd_available:.2f}')
        else:
            print('\\nℹ️  No wallets yet (expected for new installation)')

asyncio.run(test())
"
```

**Expected output:**
```
Database tables:
  wallets: ✓
  checkouts: ✓
  transactions: ✓
  liabilities: ✓

ℹ️  No wallets yet (expected for new installation)
```

---

### 2.3 Test Stripe Integration (Optional)

**If you have Stripe configured:**

```bash
# Test wallet balance endpoint
curl http://localhost:8000/payments/balance/testuser

# Expected: Auto-creates wallet with zero balance
# {"username": "testuser", "brl_available": 0.0, "usd_available": 0.0, ...}
```

**Skip if backend isn't running yet**

---

## Test 3: Phase 2.3 - Stellar Testnet Tools

### 3.1 Verify Stellar Tools Import

```bash
cd src/server

python3 -c "
from tools.stellar_tools import (
    ensure_account_exists,
    establish_trustline,
    mint_mock_brz,
    swap_brz_to_usdc,
    MOCK_BRZ_ASSET,
    USDC_ASSET
)
print('✓ stellar_tools imports OK')
print(f'  Mock-BRZ Issuer: {MOCK_BRZ_ASSET.issuer[:10]}...')
print(f'  USDC Issuer: {USDC_ASSET.issuer[:10]}...')
"
```

**Expected:**
```
✓ stellar_tools imports OK
  Mock-BRZ Issuer: GBQJ6P6OSG...
  USDC Issuer: GBBD47IF6L...
```

---

### 3.2 Test Stellar Account Creation

```bash
python3 -c "
from stellar_sdk import Keypair
from tools.stellar_tools import ensure_account_exists, establish_trustline, MOCK_BRZ_ASSET, USDC_ASSET

print('Creating test Stellar account...')

# Generate test user
user_kp = Keypair.random()
print(f'Test user: {user_kp.public_key}')

# Fund via Friendbot
if ensure_account_exists(user_kp.public_key):
    print('✓ Account funded')

    # Establish trustlines
    brz_tx = establish_trustline(user_kp, MOCK_BRZ_ASSET)
    usdc_tx = establish_trustline(user_kp, USDC_ASSET)

    if brz_tx and usdc_tx:
        print('✓ Trustlines established')
        print(f'\\n🎉 Test account ready: {user_kp.public_key}')
        print(f'   Save this for next test: {user_kp.secret}')
"
```

**Expected output:**
```
Creating test Stellar account...
Test user: GCFA3TUOTMNDERTKMSGTGAOZY7S5LZZC5ZFUBYKVO56WED7NUF3LZMED
   Creating account via Friendbot: GCFA3TUOTM...
   ✓ Account funded: GCFA3TUOTM...
✓ Account funded
   ✓ Trustline established for BRZ: d683bb91f8...
   ✓ Trustline established for USDC: ed31162406...
✓ Trustlines established

🎉 Test account ready: GCFA3TUOTMNDERTKMSGTGAOZY7S5LZZC5ZFUBYKVO56WED7NUF3LZMED
   Save this for next test: S...
```

**Save the public key and secret key for the next test!**

---

### 3.3 Test Mock-BRZ Minting

```bash
# Replace with the public key from previous test
export TEST_USER_PUBLIC_KEY="GCFA3TUOTMNDERTKMSGTGAOZY7S5LZZC5ZFUBYKVO56WED7NUF3LZMED"

python3 -c "
import os
from tools.stellar_tools import mint_mock_brz

user_pk = os.environ['TEST_USER_PUBLIC_KEY']

print(f'Minting Mock-BRZ to {user_pk[:10]}...')

tx_hash = mint_mock_brz(user_pk, 5500.0)

if tx_hash:
    print(f'\\n🎉 SUCCESS!')
    print(f'   Transaction: https://stellar.expert/explorer/testnet/tx/{tx_hash}')
    print(f'   User now has R$5,500.00 Mock-BRZ')
else:
    print('✗ Minting failed')
"
```

**Expected output:**
```
Minting Mock-BRZ to GCFA3TUOTM...
🪙 Minting R$5500.00 Mock-BRZ for GCFA3TUOTM...
   ✓ Account exists: GCFA3TUOTM...
   ✓ Minted R$5500.00 Mock-BRZ: abc123def4...
   Stellar Explorer: https://stellar.expert/explorer/testnet/tx/abc123def4...

🎉 SUCCESS!
   Transaction: https://stellar.expert/explorer/testnet/tx/abc123def4...
   User now has R$5,500.00 Mock-BRZ
```

**Click the Stellar Explorer link to verify the transaction on the blockchain!**

---

### 3.4 Test BRZ → USDC Swap

```bash
python3 -c "
import os
from tools.stellar_tools import swap_brz_to_usdc

user_pk = os.environ['TEST_USER_PUBLIC_KEY']

print(f'Swapping BRZ to USDC for {user_pk[:10]}...')

result = swap_brz_to_usdc(user_pk, 5500.0, 5.5)

if result:
    print(f'\\n🎉 SWAP SUCCESS!')
    print(f'   Sent: R${result[\"amount_brz_sent\"]:.2f}')
    print(f'   Received: ${result[\"amount_usdc_received\"]:.2f} USDC')
    print(f'   Rate: {result[\"actual_rate\"]:.4f} BRL/USD')
    print(f'   Transaction: https://stellar.expert/explorer/testnet/tx/{result[\"tx_id\"]}')
else:
    print('✗ Swap failed')
"
```

**Expected output:**
```
Swapping BRZ to USDC for GCFA3TUOTM...
🔄 Swapping R$5500.00 Mock-BRZ → USDC (rate: 5.5000)...
   Expected: $1000.00 USDC (min: $980.00)
   ✓ Swap complete: R$5500.00 → $1000.00 USDC
   TX: def456ghi7...

🎉 SWAP SUCCESS!
   Sent: R$5500.00
   Received: $1000.00 USDC
   Rate: 5.5000 BRL/USD
   Transaction: https://stellar.expert/explorer/testnet/tx/def456ghi7...
```

---

## Test 4: Integration Test - Backend Startup

### 4.1 Start Backend

```bash
cd src/server

# Start FastAPI backend
docker-compose up backend

# OR if not using Docker:
uvicorn my_fastapi_app.app.main:app --reload
```

**Expected output:**
```
🚀 Revellio Backend: Startup event triggered
🚀 Revellio Backend: Initializing database...
🚀 Revellio Backend: Starting market monitor background task...
🚀 Revellio Backend: Startup complete!
INFO:     Application startup complete.
```

**Watch for any errors during startup!**

---

### 4.2 Test /agents/status Endpoint

```bash
# In a new terminal
curl http://localhost:8000/agents/status | jq .
```

**Expected output:**
```json
{
  "payment_decisions": [...],
  "route_options": [...],
  "brl_balance": 50000.0,
  "usd_balance": 0.0,
  "current_fx_rate": 5.5,
  "pending_liabilities": [...],
  "market_prediction": "BULLISH",
  "market_analysis": {
    "prediction": "BULLISH",
    "confidence": 0.75,
    "thesis": "...",
    "metrics": {...},
    "risk_flags": [...],
    "fetched_at": "2026-04-01T15:30:00"  // ← Should be present
  },
  "selected_route": "...",
  "audit_hash": "..."
}
```

**Key checks:**
- ✅ `market_analysis.fetched_at` exists (Phase 1 Step 1.2)
- ✅ `payment_decisions` has `market_confidence` and `risk_flags` (Phase 1 Step 1.3)
- ✅ No errors in console

---

### 4.3 Test Frontend Connection

```bash
# Start frontend
cd src/client
npm run dev

# Visit: http://localhost:5173
```

**Test:**
1. Navigate to **Dashboard** - Should load without errors
2. Navigate to **Bill Scheduler** - Should show agent recommendations
3. Navigate to **Wallet** - Should show balance (may be zero)
4. Try **adding an expense** - Should work without date error (bugfix verified)

---

## Test 5: Verify Bugfix

### 5.1 Test Expense Creation

```bash
curl -X POST http://localhost:8000/expenses/create \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "name": "Test Tuition",
    "amount": 150.0,
    "currency": "USD",
    "due_date": "2026-04-15",
    "category": "Education"
  }'
```

**Expected:** Success response (no `asyncpg.exceptions.DataError`)

---

## Summary Checklist

Run these tests in order and check off each one:

- [ ] **Test 1.1**: All Phase 1 files compile
- [ ] **Test 1.2**: All imports work
- [ ] **Test 1.3**: Pydantic schemas validate
- [ ] **Test 2.1**: Database migration applied
- [ ] **Test 2.2**: Database tables exist
- [ ] **Test 3.1**: Stellar tools import
- [ ] **Test 3.2**: Stellar account creation works
- [ ] **Test 3.3**: Mock-BRZ minting succeeds
- [ ] **Test 3.4**: BRZ → USDC swap succeeds
- [ ] **Test 4.1**: Backend starts without errors
- [ ] **Test 4.2**: `/agents/status` returns valid data with `fetched_at`
- [ ] **Test 4.3**: Frontend loads and connects
- [ ] **Test 5.1**: Expense creation works (bugfix verified)

---

## If Tests Fail

**Common issues:**

1. **Import errors**: Check `.env` file has all required variables
2. **Database errors**: Run `alembic upgrade head`
3. **Stellar errors**: Verify `STELLAR_MOCK_BRZ_ISSUER` is funded
4. **API errors**: Check API keys in `.env`

**Report results and I'll help debug!**
