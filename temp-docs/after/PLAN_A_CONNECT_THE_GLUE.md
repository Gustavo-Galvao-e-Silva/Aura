# Plan A: Connect the Glue (Backend Integration)

**Owner:** You (user)
**Branch:** `feat/connect-glue`
**Goal:** Hook up agents → settlement flow with real-time FX rates
**Estimated Time:** 2-3 hours

---

## Prerequisites

✅ Teammate fixed BRL deposits (commit `1f6846d`)
✅ Teammate fixed multi-user filtering (commit `f73f1bc`)
✅ Settlement flow works (`/payments/settle`)
✅ Routes agent fetches Crebit/Wise/Remitly rates

---

## What You're Building

**Before:** Agents recommend "Pay Now" → Nothing happens

**After:** Agents recommend "Pay Now" → Settlement executes with best FX rate

**Flow:**
```
User deposits R$5,500 via Stripe
     ↓
Agents analyze market → "Pay Now" on $1,000 tuition bill
     ↓
Routes agent fetches: Crebit (5.23), Wise (5.18), Remitly (5.20)
     ↓
Settlement uses BEST rate (5.18 from Wise) → Needs R$5,180
     ↓
BRL → BRZ → USDC flow executes
     ↓
Bill marked paid, email sent with blockchain proof
```

---

## Implementation Steps

### Step 1: Add Real-Time FX Rate Helper (30 min)

**Create:** `src/server/my_fastapi_app/app/services/fx_service.py`

```python
"""
FX rate service for stablecoin settlement.

Uses routes agent data to get real-time BRL/USD rates from providers.
"""
from typing import Optional
from my_fastapi_app.app.state import get_current_state


def get_best_fx_rate() -> dict:
    """
    Get the best FX rate from available routes.

    Returns:
        {
            "rate": 5.18,              # BRL per USD
            "provider": "Wise",        # Which provider has best rate
            "all_rates": [...]         # All available rates
        }

    The "best" rate is the LOWEST BRL per USD (user pays less BRL).
    """
    state = get_current_state()
    route_options = state.get("route_options", [])

    if not route_options:
        # Fallback if routes agent hasn't run yet
        return {
            "rate": 5.5,
            "provider": "fallback",
            "all_rates": [],
            "note": "Using fallback rate - routes agent not available"
        }

    # Get all valid rates
    valid_routes = [
        {
            "provider": r["name"],
            "rate": r["fx_used"],
            "fee_usd": r.get("fee_usd", 0.0)
        }
        for r in route_options
        if r.get("fx_used") is not None
    ]

    if not valid_routes:
        return {
            "rate": 5.5,
            "provider": "fallback",
            "all_rates": [],
            "note": "No valid rates found"
        }

    # Find best rate (lowest BRL per USD = user pays less)
    best_route = min(valid_routes, key=lambda x: x["rate"])

    return {
        "rate": best_route["rate"],
        "provider": best_route["provider"],
        "all_rates": valid_routes,
        "fee_usd": best_route["fee_usd"]
    }


def calculate_brl_needed(amount_usd: float, include_fees: bool = True) -> dict:
    """
    Calculate how much BRL is needed to pay a USD bill.

    Args:
        amount_usd: Bill amount in USD
        include_fees: Whether to include provider fees

    Returns:
        {
            "amount_brl": 5180.0,      # Total BRL needed
            "fx_rate": 5.18,           # Rate used
            "provider": "Wise",        # Provider
            "fee_usd": 15.0,           # Fee in USD
            "fee_brl": 77.7,           # Fee in BRL
            "base_amount": 5102.3      # Amount before fees
        }
    """
    rate_info = get_best_fx_rate()

    fx_rate = rate_info["rate"]
    fee_usd = rate_info.get("fee_usd", 0.0) if include_fees else 0.0

    # Calculate BRL needed
    total_usd = amount_usd + fee_usd
    amount_brl = total_usd * fx_rate

    return {
        "amount_brl": amount_brl,
        "fx_rate": fx_rate,
        "provider": rate_info["provider"],
        "fee_usd": fee_usd,
        "fee_brl": fee_usd * fx_rate,
        "base_amount": amount_usd * fx_rate,
        "all_rates": rate_info.get("all_rates", [])
    }
```

**Test:**
```python
# In Python REPL or test script
from my_fastapi_app.app.services.fx_service import get_best_fx_rate, calculate_brl_needed

# Test 1: Get best rate
rate_info = get_best_fx_rate()
print(f"Best rate: {rate_info['rate']} from {rate_info['provider']}")

# Test 2: Calculate BRL needed
calc = calculate_brl_needed(amount_usd=1000.0)
print(f"$1,000 bill needs R${calc['amount_brl']:.2f} (via {calc['provider']})")
```

---

### Step 2: Update Settlement to Use Real-Time Rate (20 min)

**Modify:** `src/server/my_fastapi_app/app/routes/payments.py`

**Find line 396:**
```python
# Before:
fx_rate = 5.5  # 1 USD = 5.5 BRL
amount_usd = liability.amount
amount_brl_needed = amount_usd * fx_rate
```

**Replace with:**
```python
# After:
from my_fastapi_app.app.services.fx_service import calculate_brl_needed

amount_usd = liability.amount

# Get real-time rate from routes agent
brl_calc = calculate_brl_needed(amount_usd, include_fees=False)
fx_rate = brl_calc["fx_rate"]
amount_brl_needed = brl_calc["amount_brl"]
provider = brl_calc["provider"]

print(f"   Liability: {liability.name} = ${amount_usd:.2f} USD")
print(f"   FX Rate: {fx_rate:.2f} BRL/USD (via {provider})")
print(f"   BRL needed: R${amount_brl_needed:.2f}")
print(f"   Wallet BRL available: R${wallet.brl_available:.2f}")
```

**Also update transaction metadata (around line 504):**
```python
# Before:
metadata_json={
    "stellar_mint_tx": stellar_mint_tx,
    "stellar_swap_tx": stellar_swap_tx,
    "fx_rate": fx_rate,
    "amount_usd": amount_usd,
    # ...
}

# After:
metadata_json={
    "stellar_mint_tx": stellar_mint_tx,
    "stellar_swap_tx": stellar_swap_tx,
    "fx_rate": fx_rate,
    "fx_provider": provider,  # ← NEW: Track which provider's rate was used
    "amount_usd": amount_usd,
    "available_rates": brl_calc.get("all_rates", []),  # ← NEW: Show all options
    # ...
}
```

**Test:**
```bash
# 1. Ensure routes agent has run (so route_options exists)
curl http://localhost:8000/agents/status?username=testuser | jq '.route_options'

# Should show Crebit, Wise, Remitly rates

# 2. Trigger settlement
curl -X POST http://localhost:8000/payments/settle \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "liability_id": 1
  }' | jq '.'

# 3. Check logs - should see:
#    FX Rate: 5.18 BRL/USD (via Wise)
#    BRL needed: R$5,180.00

# 4. Verify email shows correct provider
```

---

### Step 3: Update Email Receipt (15 min)

**Modify:** `src/server/my_fastapi_app/app/services/mail_service.py`

**Find `send_payment_receipt_email` function, update email body:**

```python
# Add after fx_rate parameter (line ~50):
def send_payment_receipt_email(
    to_email: str,
    username: str,
    liability_name: str,
    amount_usd: float,
    amount_brl_spent: float,
    fx_rate: float,
    fx_provider: str = "Revellio",  # ← NEW parameter
    stellar_mint_tx: str = "",
    stellar_swap_tx: str = "",
    transaction_id: int = None
):
    # ... existing code ...

    # Update email body (around line 75):
    body = f"""
Hello @{username},

Your payment has been successfully processed! 🎉

PAYMENT DETAILS:
- Bill: {liability_name}
- Amount: ${amount_usd:.2f} USD
- BRL Spent: R${amount_brl_spent:.2f} BRL
- FX Rate: {fx_rate:.2f} BRL/USD (from {fx_provider})  # ← Show provider
- Transaction ID: {transaction_id}

ROUTE OPTIMIZATION:
Revellio's AI agents analyzed real-time rates from Crebit, Wise, and Remitly.
Your payment used the best available rate from {fx_provider} to minimize costs.

BLOCKCHAIN PROOF:
Mock-BRZ Mint: https://stellar.expert/explorer/testnet/tx/{stellar_mint_tx}

Your bill is now marked as PAID.

Questions? Reply to this email.

- Revellio Team
""".strip()
```

**Update call site in payments.py (line 531):**
```python
# Before:
send_payment_receipt_email(
    to_email=user.email,
    username=payment.username,
    liability_name=liability.name,
    amount_usd=amount_usd,
    amount_brl_spent=amount_brl_needed,
    fx_rate=fx_rate,
    stellar_mint_tx=stellar_mint_tx,
    stellar_swap_tx=stellar_swap_tx,
    transaction_id=tx.id
)

# After:
send_payment_receipt_email(
    to_email=user.email,
    username=payment.username,
    liability_name=liability.name,
    amount_usd=amount_usd,
    amount_brl_spent=amount_brl_needed,
    fx_rate=fx_rate,
    fx_provider=provider,  # ← NEW: Pass provider name
    stellar_mint_tx=stellar_mint_tx,
    stellar_swap_tx=stellar_swap_tx,
    transaction_id=tx.id
)
```

---

### Step 4: Optional - Add Rate Comparison Logging (10 min)

**Add to settlement flow (after calculating BRL needed):**

```python
# payments.py around line 403
print(f"   📊 Rate Comparison:")
for rate_option in brl_calc.get("all_rates", []):
    provider_name = rate_option["provider"]
    provider_rate = rate_option["rate"]
    would_cost = amount_usd * provider_rate
    savings = would_cost - amount_brl_needed

    if provider_name == provider:
        print(f"      ✅ {provider_name}: {provider_rate:.2f} BRL/USD = R${would_cost:.2f} (SELECTED)")
    else:
        print(f"      ⚪ {provider_name}: {provider_rate:.2f} BRL/USD = R${would_cost:.2f} (+R${savings:.2f})")
```

**Example output:**
```
   📊 Rate Comparison:
      ✅ Wise: 5.18 BRL/USD = R$5,180.00 (SELECTED)
      ⚪ Remitly: 5.20 BRL/USD = R$5,200.00 (+R$20.00)
      ⚪ Crebit: 5.23 BRL/USD = R$5,230.00 (+R$50.00)
```

---

## Testing Plan

### Test 1: Verify Routes Agent Runs First

```bash
# Routes agent must run BEFORE settlement can use rates
curl http://localhost:8000/agents/status?username=testuser | jq '.route_options'

# Expected:
[
  {
    "name": "Crebit",
    "fx_used": 5.23,
    "fee_usd": 12.0
  },
  {
    "name": "Wise",
    "fx_used": 5.18,
    "fee_usd": 15.0
  },
  {
    "name": "Remitly",
    "fx_used": 5.20,
    "fee_usd": 10.0
  }
]
```

### Test 2: Settlement Uses Best Rate

```bash
# Create test user and bill
docker exec -it server-db-1 psql -U postgres -c "
INSERT INTO users (username, fullname, email)
VALUES ('testuser', 'Test User', 'test@example.com')
ON CONFLICT DO NOTHING;

INSERT INTO wallets (username, brl_available, usd_available, total_deposited_brl)
VALUES ('testuser', 10000.0, 0.0, 10000.0)
ON CONFLICT (username) DO UPDATE SET brl_available = 10000.0;
"

# Create bill
curl -X POST http://localhost:8000/expenses/create \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "name": "Test Bill",
    "amount": 1000.0,
    "currency": "USD",
    "due_date": "2026-05-01",
    "category": "Education"
  }'

# Execute settlement
curl -X POST http://localhost:8000/payments/settle \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "liability_id": 1
  }' | jq '.'

# Verify response includes provider
# Expected:
# {
#   "fx_rate": 5.18,
#   "fx_provider": "Wise",  ← Should be best rate
#   "amount_brl_spent": 5180.0
# }
```

### Test 3: Email Shows Correct Provider

```bash
# Check email (if SMTP configured)
# Subject: "Payment Confirmed: Test Bill"
# Body should include:
# "FX Rate: 5.18 BRL/USD (from Wise)"
# "Revellio's AI agents analyzed real-time rates..."
```

### Test 4: Fallback Works (No Routes Available)

```bash
# Simulate routes agent failure
# (Temporarily comment out routes agent in graph.py or clear route_options)

# Settlement should still work with fallback rate
curl -X POST http://localhost:8000/payments/settle \
  -d '{"username": "testuser", "liability_id": 2}'

# Logs should show:
# "Using fallback rate - routes agent not available"
# "FX Rate: 5.5 BRL/USD (via fallback)"
```

---

## Success Criteria

- ✅ Settlement uses real-time FX rate from routes agent
- ✅ Best rate (lowest BRL per USD) is automatically selected
- ✅ Email shows which provider's rate was used
- ✅ Transaction metadata includes all available rates
- ✅ Logs show rate comparison
- ✅ Fallback to 5.5 if routes unavailable

---

## Edge Cases

**What if routes agent returns no rates?**
- Fallback to 5.5 BRL/USD
- Log warning
- Email notes: "Estimated rate used"

**What if multiple providers have same rate?**
- Pick first in list (deterministic)
- Doesn't matter - same cost to user

**What if routes agent is slow?**
- Routes agent runs in background (graph.py)
- Should complete before user clicks "Pay Bill"
- If not: use cached rate from last run

---

## Files Modified

1. **NEW:** `src/server/my_fastapi_app/app/services/fx_service.py` (FX rate helper)
2. **EDIT:** `src/server/my_fastapi_app/app/routes/payments.py` (use real-time rate)
3. **EDIT:** `src/server/my_fastapi_app/app/services/mail_service.py` (show provider in email)

---

## Next Steps After This Plan

Once Plan A is complete:
1. Merge `feat/connect-glue` to `main`
2. Coordinate with teammate on Plan B (agent visualization)
3. Optional: Add auto-execution logic (hybrid approach)
4. Optional: Connect frontend "Pay Bill" buttons

---

**Ready to implement?** Create branch `feat/connect-glue` and follow steps 1-4!
