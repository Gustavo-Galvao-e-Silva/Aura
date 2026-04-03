# Plan A: Connect the Glue (Backend Integration)

**Owner:** You
**Branch:** `feat/connect-glue`
**Goal:** Stripe webhook + Real-time FX rates + Auto-executor + Frontend integration
**Estimated Time:** 3-4 hours

---

## Prerequisites

✅ Teammate fixed BRL deposits (commit `1f6846d`)
✅ Teammate fixed multi-user filtering (commit `f73f1bc`)
✅ Settlement flow works (`/payments/settle`)
✅ Routes agent has fallbacks (returns defaults if APIs fail)

---

## What You're Building

**End Goal:**
```
User deposits R$5,500 via Stripe
     ↓
Routes agent fetches rates (Crebit/Wise/Remitly - with fallbacks)
     ↓
Agents analyze → "Pay Now" on $1,000 bill (85% confidence)
     ↓
Auto-executor runs every 15 min → Detects high confidence
     ↓
Settlement uses BEST rate (e.g., 5.18 from Wise)
     ↓
BRL → BRZ → USDC flow executes
     ↓
Bill marked paid, email sent: "Aura paid your bill at optimal rate!"
```

---

## Implementation Steps

### Step 1: Stripe Webhook Setup (15 min)

**Goal:** Enable Stripe deposits to credit wallet

**Context:** Teammate already configured Stripe to deposit BRL (not USD). You just need to forward webhooks.

#### 1.1 Install Stripe CLI (if not installed)

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.5/stripe_1.19.5_linux_x86_64.tar.gz
tar -xvf stripe_1.19.5_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

#### 1.2 Login to Stripe (one-time)

```bash
stripe login
# Follow browser authentication flow
```

#### 1.3 Start Webhook Forwarding

```bash
# Run this command (keep it running in a terminal)
stripe listen --forward-to http://localhost:8000/payments/webhook
```

**Expected output:**
```
> Ready! Your webhook signing secret is whsec_abc123...
```

#### 1.4 Copy Webhook Secret to .env

```bash
# In your .env file, add:
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

#### 1.5 Test Webhook

```bash
# In another terminal, trigger test deposit
stripe trigger checkout.session.completed

# Check backend logs - should see:
# "📨 Stripe webhook: checkout.session.completed"
# "✅ Credited @testuser R$XXX.XX"
```

**Success:** Stripe deposits now work!

---

### Step 2: Integrate Teammate's Widgets into BillScheduler (30 min)

**Goal:** Display Market Analysis and Route Comparison cards in frontend

**Context:** Teammate creates the widget components. You integrate them into BillScheduler page.

**Wait for teammate to finish:**
- `src/client/src/components/MarketAnalysisCard.tsx`
- `src/client/src/components/RouteComparisonCard.tsx`

**Once ready, modify:** `src/client/src/pages/BillScheduler.tsx`

#### 2.1 Import Components

```typescript
// Add at top of file (around line 5)
import { MarketAnalysisCard } from "../components/MarketAnalysisCard";
import { RouteComparisonCard } from "../components/RouteComparisonCard";
```

#### 2.2 Add Cards Before Bill List

**Find the bill list section (around line 300-400), add BEFORE it:**

```typescript
{/* Market Intelligence Section */}
<div style={{ marginBottom: "2rem" }}>
  {/* Market Analysis Card */}
  {status && status.market_analysis && (
    <MarketAnalysisCard analysis={status.market_analysis} />
  )}

  {/* Route Comparison Card */}
  {status && status.route_options && status.route_options.length > 0 && (
    <RouteComparisonCard
      routes={status.route_options}
      selectedRoute={status.selected_route}
    />
  )}
</div>

{/* Bill List (existing code below) */}
```

#### 2.3 Test Frontend Integration

```bash
# 1. Start backend
cd src/server
# (ensure backend is running)

# 2. Start frontend
cd src/client
npm run dev

# 3. Navigate to Bill Scheduler
open http://localhost:5173/bill-scheduler

# 4. Verify cards display:
#    - Market Analysis shows prediction, confidence, thesis
#    - Route Comparison shows Crebit/Wise/Remitly rates
```

**Success:** Frontend shows agent intelligence!

---

### Step 3: Create FX Service (30 min)

**Goal:** Get best real-time FX rate from routes agent

**Create:** `src/server/my_fastapi_app/app/services/fx_service.py`

```python
"""
FX rate service for stablecoin settlement.

Uses routes agent data to get real-time BRL/USD rates.
Router.py has fallbacks, so this always returns a valid rate.
"""
from typing import Optional
from my_fastapi_app.app.state import get_current_state


def get_best_fx_rate() -> dict:
    """
    Get the best FX rate from available routes.

    Returns the LOWEST BRL per USD rate (user pays less BRL).

    Returns:
        {
            "rate": 5.18,              # BRL per USD
            "provider": "Wise",        # Which provider has best rate
            "all_rates": [...]         # All available rates for logging
        }

    Note: Router.py has fallbacks, so route_options always has data.
    """
    state = get_current_state()
    route_options = state.get("route_options", [])

    if not route_options:
        # Fallback if state not initialized yet
        print("⚠️  FX Service: No route_options in state, using fallback rate")
        return {
            "rate": 5.5,
            "provider": "fallback",
            "all_rates": [],
            "note": "Fallback rate - routes agent not initialized"
        }

    # Extract all valid rates
    valid_routes = []
    for route in route_options:
        fx_used = route.get("fx_used")
        if fx_used is not None and fx_used > 0:
            valid_routes.append({
                "provider": route["name"],
                "rate": fx_used,
                "fee_usd": route.get("fee_usd", 0.0),
                "description": route.get("description", "")
            })

    if not valid_routes:
        print("⚠️  FX Service: No valid rates found, using fallback")
        return {
            "rate": 5.5,
            "provider": "fallback",
            "all_rates": [],
            "note": "No valid rates from providers"
        }

    # Find best rate (LOWEST BRL per USD = user pays less)
    best_route = min(valid_routes, key=lambda x: x["rate"])

    print(f"💱 FX Service: Best rate = {best_route['rate']:.2f} BRL/USD from {best_route['provider']}")
    print(f"   All rates: {[(r['provider'], r['rate']) for r in valid_routes]}")

    return {
        "rate": best_route["rate"],
        "provider": best_route["provider"],
        "all_rates": valid_routes,
        "fee_usd": best_route.get("fee_usd", 0.0)
    }


def calculate_brl_needed(amount_usd: float, include_fees: bool = False) -> dict:
    """
    Calculate how much BRL is needed to pay a USD bill.

    Args:
        amount_usd: Bill amount in USD
        include_fees: Whether to include provider fees (default False for stablecoin flow)

    Returns:
        {
            "amount_brl": 5180.0,      # Total BRL needed
            "fx_rate": 5.18,           # Rate used
            "provider": "Wise",        # Provider with best rate
            "fee_usd": 0.0,            # Fee (0 for stablecoins)
            "all_rates": [...]         # All available rates
        }
    """
    rate_info = get_best_fx_rate()

    fx_rate = rate_info["rate"]
    fee_usd = rate_info.get("fee_usd", 0.0) if include_fees else 0.0

    # Calculate BRL needed
    # Note: We don't include fees for stablecoin flow (fees are for traditional routes)
    total_usd = amount_usd + fee_usd
    amount_brl = total_usd * fx_rate

    return {
        "amount_brl": amount_brl,
        "fx_rate": fx_rate,
        "provider": rate_info["provider"],
        "fee_usd": fee_usd,
        "all_rates": rate_info.get("all_rates", [])
    }
```

#### Test FX Service

```bash
# In backend Python shell or test script
cd src/server
python3

>>> from my_fastapi_app.app.services.fx_service import get_best_fx_rate, calculate_brl_needed

# Test 1: Get best rate
>>> rate_info = get_best_fx_rate()
>>> print(f"Best rate: {rate_info['rate']} from {rate_info['provider']}")
# Should show: Best rate: 5.18 from Wise (or fallback 5.5)

# Test 2: Calculate BRL needed
>>> calc = calculate_brl_needed(amount_usd=1000.0)
>>> print(f"$1,000 needs R${calc['amount_brl']:.2f} via {calc['provider']}")
# Should show: $1,000 needs R$5,180.00 via Wise
```

---

### Step 4: Update Settlement to Use Real-Time Rate (20 min)

**Modify:** `src/server/my_fastapi_app/app/routes/payments.py`

#### 4.1 Add Import

```python
# At top of file (around line 10)
from my_fastapi_app.app.services.fx_service import calculate_brl_needed
```

#### 4.2 Replace Hardcoded Rate

**Find line ~396:**
```python
# Before:
fx_rate = 5.5  # 1 USD = 5.5 BRL
amount_usd = liability.amount
amount_brl_needed = amount_usd * fx_rate
```

**Replace with:**
```python
# After:
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

# Optional: Log rate comparison
print(f"   📊 Rate Comparison:")
for rate_option in brl_calc.get("all_rates", []):
    r_name = rate_option["provider"]
    r_rate = rate_option["rate"]
    would_cost = amount_usd * r_rate
    savings = would_cost - amount_brl_needed

    if r_name == provider:
        print(f"      ✅ {r_name}: {r_rate:.2f} = R${would_cost:.2f} (SELECTED)")
    else:
        print(f"      ⚪ {r_name}: {r_rate:.2f} = R${would_cost:.2f} (+R${savings:.2f})")
```

#### 4.3 Update Transaction Metadata

**Find line ~504 (transaction metadata):**
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
    "fx_provider": provider,  # ← NEW: Track which provider
    "amount_usd": amount_usd,
    "available_rates": brl_calc.get("all_rates", []),  # ← NEW: All options
    # ... rest unchanged
}
```

#### Test Settlement

```bash
# 1. Trigger agent status (ensure routes agent runs)
curl http://localhost:8000/agents/status?username=testuser | jq '.route_options'

# 2. Create test bill
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

# 3. Execute settlement
curl -X POST http://localhost:8000/payments/settle \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "liability_id": 1
  }' | jq '.'

# 4. Check logs - should show:
#    FX Rate: 5.18 BRL/USD (via Wise)
#    📊 Rate Comparison:
#       ✅ Wise: 5.18 = R$5,180.00 (SELECTED)
#       ⚪ Remitly: 5.20 = R$5,200.00 (+R$20.00)
#       ⚪ Crebit: 5.23 = R$5,230.00 (+R$50.00)
```

---

### Step 5: Update Email Receipt (15 min)

**Modify:** `src/server/my_fastapi_app/app/services/mail_service.py`

#### 5.1 Add Provider Parameter

**Find `send_payment_receipt_email` function (around line 50):**
```python
# Before:
def send_payment_receipt_email(
    to_email: str,
    username: str,
    liability_name: str,
    amount_usd: float,
    amount_brl_spent: float,
    fx_rate: float,
    stellar_mint_tx: str = "",
    stellar_swap_tx: str = "",
    transaction_id: int = None
):

# After:
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
```

#### 5.2 Update Email Body

**Find email body (around line 75):**
```python
# Before:
body = f"""
Hello @{username},

Your payment has been successfully processed! 🎉

PAYMENT DETAILS:
- Bill: {liability_name}
- Amount: ${amount_usd:.2f} USD
- BRL Spent: R${amount_brl_spent:.2f} BRL
- FX Rate: {fx_rate:.2f} BRL/USD
- Transaction ID: {transaction_id}

BLOCKCHAIN PROOF:
Mock-BRZ Mint: https://stellar.expert/explorer/testnet/tx/{stellar_mint_tx}
...
"""

# After:
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

#### 5.3 Update Call Site in payments.py

**Find line ~531 in payments.py:**
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

### Step 6: Create Auto-Executor (1.5 hours)

**Goal:** Automatically execute high-confidence "pay now" decisions

**Create:** `src/server/agents/auto_executor.py`

```python
"""
Autonomous payment executor for high-confidence decisions.

Runs as background task, checks every 15 minutes for bills that:
- Agents recommend "Pay Now"
- Confidence ≥ 90%
- Not already paid
- Not predicted expenses (confirmed only)

Then executes settlement automatically.
"""
from datetime import datetime
from typing import Optional
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Liability, Users, Wallet
from agents.graph import app as agent_graph
from agents.state import AuraState
from my_fastapi_app.app.routes.payments import settle_payment, SettlementRequest
from my_fastapi_app.app.db.session import AsyncSessionLocal
from my_fastapi_app.app.services.mail_service import send_auto_execution_notification


# Configuration
AUTO_EXECUTE_CONFIDENCE_THRESHOLD = 0.90  # 90% confidence required
AUTO_EXECUTE_INTERVAL_MINUTES = 15        # Check every 15 minutes


async def check_and_execute_high_confidence_payments():
    """
    Check for high-confidence 'pay now' decisions and execute them.

    Flow:
    1. Get all users
    2. Run agent graph for each user
    3. Check each payment decision
    4. Auto-execute if confidence ≥ 90% and "pay now"
    5. Send notification email
    """
    print(f"🤖 Auto-executor: Checking for high-confidence payments...")

    async with AsyncSessionLocal() as db:
        try:
            # Get all users
            result = await db.execute(select(Users))
            users = result.scalars().all()

            total_executed = 0

            for user in users:
                # Run agent graph for this user
                state = AuraState(username=user.username)

                try:
                    agent_result = await agent_graph.ainvoke(state)
                except Exception as e:
                    print(f"   ⚠️  Agent graph failed for {user.username}: {e}")
                    continue

                # Check each decision
                for decision in agent_result.get("payment_decisions", []):
                    confidence = decision.get("market_confidence", 0.0)
                    should_pay = decision.get("pay", False)
                    is_predicted = decision.get("is_predicted", False)
                    liability_id = decision.get("liability_id")

                    # Auto-execute criteria:
                    # - High confidence (≥90%)
                    # - Agent says "pay now"
                    # - Not a predicted expense (confirmed bills only)
                    # - Has liability ID
                    if (confidence >= AUTO_EXECUTE_CONFIDENCE_THRESHOLD and
                        should_pay and
                        not is_predicted and
                        liability_id):

                        # Check if already paid
                        liability_result = await db.execute(
                            select(Liability).where(Liability.id == liability_id)
                        )
                        liability = liability_result.scalar_one_or_none()

                        if liability and not liability.is_paid:
                            print(f"   🚀 Auto-executing payment for {user.username}: {decision.get('name')}")
                            print(f"      Confidence: {confidence:.1%}")
                            print(f"      Reason: {decision.get('reason', 'N/A')}")

                            try:
                                # Execute settlement
                                settlement_result = await settle_payment(
                                    payment=SettlementRequest(
                                        username=user.username,
                                        liability_id=liability_id
                                    ),
                                    db=db
                                )

                                # Send notification email
                                try:
                                    send_auto_execution_notification(
                                        to_email=user.email,
                                        username=user.username,
                                        liability_name=liability.name,
                                        amount_usd=settlement_result.amount_usd,
                                        amount_brl_spent=settlement_result.amount_brl_spent,
                                        confidence=confidence,
                                        reason=decision.get("reason", "Market conditions optimal"),
                                        fx_rate=settlement_result.fx_rate,
                                        fx_provider=settlement_result.fx_provider,
                                        stellar_mint_tx=settlement_result.stellar_mint_tx
                                    )
                                except Exception as e:
                                    print(f"      ⚠️  Email notification failed (non-fatal): {e}")

                                total_executed += 1
                                print(f"      ✅ Auto-executed successfully!")

                            except Exception as e:
                                print(f"      ❌ Auto-execution failed: {e}")
                        elif liability and liability.is_paid:
                            print(f"   ⏭️  Skipping {decision.get('name')} - already paid")

            print(f"🤖 Auto-executor: Completed. Executed {total_executed} payment(s)")

        except Exception as e:
            print(f"❌ Auto-executor error: {e}")
            import traceback
            traceback.print_exc()


async def auto_executor_loop():
    """
    Background loop that runs the auto-executor periodically.

    This is started as a FastAPI background task on startup.
    """
    print(f"🤖 Auto-executor: Starting (checking every {AUTO_EXECUTE_INTERVAL_MINUTES} minutes)")
    print(f"   Confidence threshold: {AUTO_EXECUTE_CONFIDENCE_THRESHOLD:.0%}")

    while True:
        try:
            await check_and_execute_high_confidence_payments()
        except Exception as e:
            print(f"❌ Auto-executor loop error: {e}")
            import traceback
            traceback.print_exc()

        # Wait before next check
        await asyncio.sleep(AUTO_EXECUTE_INTERVAL_MINUTES * 60)
```

#### 6.2 Add Auto-Execution Email Notification

**Add to:** `src/server/my_fastapi_app/app/services/mail_service.py`

```python
def send_auto_execution_notification(
    to_email: str,
    username: str,
    liability_name: str,
    amount_usd: float,
    amount_brl_spent: float,
    confidence: float,
    reason: str,
    fx_rate: float,
    fx_provider: str,
    stellar_mint_tx: str,
):
    """
    Send notification when Aura auto-executes a payment.

    Different from receipt email - explains WHY it was auto-executed.
    """
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_password = settings.SMTP_PASSWORD
    from_email = settings.from_email

    if not smtp_host or not smtp_user or not smtp_password:
        print("⚠️  SMTP not configured - skipping auto-execution email")
        return

    subject = f"🤖 Aura Auto-Paid: {liability_name}"

    mint_link = f"https://stellar.expert/explorer/testnet/tx/{stellar_mint_tx}"

    body = f"""
Hello @{username},

Aura has automatically paid your bill based on optimal market conditions! 🤖

PAYMENT DETAILS:
- Bill: {liability_name}
- Amount: ${amount_usd:.2f} USD (R${amount_brl_spent:.2f} BRL)
- FX Rate: {fx_rate:.2f} BRL/USD (from {fx_provider})
- Confidence: {confidence:.1%}

WHY AURA PAID NOW:
{reason}

Aura detected highly favorable conditions and determined this was the
optimal time to execute your payment. This decision was made with {confidence:.1%}
confidence based on current market analysis.

BLOCKCHAIN PROOF:
{mint_link}

You can view the full transaction details in your Wallet or Audit page.

No action needed - your bill has been successfully paid! ✅

- Aura (Revellio's AI Agent)
""".strip()

    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        print(f"   ✅ Auto-execution notification sent to {to_email}")
    except Exception as e:
        print(f"   ⚠️  Failed to send notification: {e}")
```

#### 6.3 Start Auto-Executor on Backend Startup

**Modify:** `src/server/my_fastapi_app/app/main.py`

```python
# Add import at top
from agents.auto_executor import auto_executor_loop
import asyncio

# Find or create startup event
@app.on_event("startup")
async def startup_event():
    print("🚀 Revellio Backend: Startup event triggered")

    # ... any existing startup code ...

    # Start auto-executor background task
    print("🤖 Starting autonomous payment executor...")
    asyncio.create_task(auto_executor_loop())

    print("🚀 Revellio Backend: Startup complete!")
```

#### 6.4 Update Settlement Response to Include Provider

**Modify:** `src/server/my_fastapi_app/app/routes/payments.py`

**Find `SettlementResponse` model (around line 40):**
```python
# Before:
class SettlementResponse(BaseModel):
    status: str
    message: str
    liability_id: int
    liability_name: str
    amount_usd: float
    amount_brl_spent: float
    fx_rate: float
    stellar_mint_tx: str
    stellar_swap_tx: str
    database_transaction_id: int
    new_balance_brl: float
    new_balance_usd: float

# After:
class SettlementResponse(BaseModel):
    status: str
    message: str
    liability_id: int
    liability_name: str
    amount_usd: float
    amount_brl_spent: float
    fx_rate: float
    fx_provider: str  # ← NEW: Which provider's rate was used
    stellar_mint_tx: str
    stellar_swap_tx: str
    database_transaction_id: int
    new_balance_brl: float
    new_balance_usd: float
```

**Update return statement (around line 550):**
```python
# Before:
return SettlementResponse(
    status="success",
    message=f"Successfully paid {liability.name} using stablecoin flow",
    liability_id=liability.id,
    liability_name=liability.name,
    amount_usd=amount_usd,
    amount_brl_spent=amount_brl_needed,
    fx_rate=fx_rate,
    stellar_mint_tx=stellar_mint_tx,
    stellar_swap_tx=stellar_swap_tx,
    database_transaction_id=tx.id,
    new_balance_brl=wallet.brl_available,
    new_balance_usd=wallet.usd_available
)

# After:
return SettlementResponse(
    status="success",
    message=f"Successfully paid {liability.name} using stablecoin flow",
    liability_id=liability.id,
    liability_name=liability.name,
    amount_usd=amount_usd,
    amount_brl_spent=amount_brl_needed,
    fx_rate=fx_rate,
    fx_provider=provider,  # ← NEW
    stellar_mint_tx=stellar_mint_tx,
    stellar_swap_tx=stellar_swap_tx,
    database_transaction_id=tx.id,
    new_balance_brl=wallet.brl_available,
    new_balance_usd=wallet.usd_available
)
```

---

### Step 7: End-to-End Testing (30 min)

#### Test 1: Stripe Deposit

```bash
# Terminal 1: Keep stripe listen running
stripe listen --forward-to http://localhost:8000/payments/webhook

# Terminal 2: Trigger test deposit
stripe trigger checkout.session.completed

# Check logs:
# ✅ Credited @testuser R$XXX.XX
```

#### Test 2: Manual Payment (Via Frontend Button)

```bash
# 1. Frontend: Navigate to Bill Scheduler
# 2. Click "Pay Bill" on a "Pay Now" recommendation
# 3. Verify:
#    - Button shows "Processing..."
#    - Alert shows success with provider
#    - Email received with "from Wise" or best provider
```

#### Test 3: Auto-Execution

```bash
# 1. Create bill with high confidence scenario
curl -X POST http://localhost:8000/expenses/create \
  -d '{
    "username": "testuser",
    "name": "Urgent Bill",
    "amount": 100.0,
    "currency": "USD",
    "due_date": "2026-04-03",
    "category": "Education"
  }'

# 2. Wait max 15 minutes (auto-executor interval)

# 3. Check logs:
# 🤖 Auto-executor: Checking...
# 🚀 Auto-executing payment for testuser: Urgent Bill
#    Confidence: 92.3%
# ✅ Auto-executed successfully!

# 4. Check email:
# Subject: "🤖 Aura Auto-Paid: Urgent Bill"
# Body: "Aura detected highly favorable conditions..."
```

#### Test 4: Rate Comparison in Logs

```bash
# Execute any payment and check logs should show:
# 📊 Rate Comparison:
#    ✅ Wise: 5.18 = R$5,180.00 (SELECTED)
#    ⚪ Remitly: 5.20 = R$5,200.00 (+R$20.00)
#    ⚪ Crebit: 5.23 = R$5,230.00 (+R$50.00)
```

---

## Success Criteria

- ✅ Stripe webhook forwards deposits to backend
- ✅ Frontend displays Market Analysis and Route Comparison cards
- ✅ Settlement uses best real-time FX rate
- ✅ Email shows which provider was used
- ✅ Transaction metadata includes provider and all rates
- ✅ Auto-executor runs every 15 minutes
- ✅ High confidence (≥90%) payments auto-execute
- ✅ Auto-execution email sent with explanation
- ✅ Manual payment still works via frontend button

---

## Files Created/Modified

**Created:**
1. `src/server/my_fastapi_app/app/services/fx_service.py` - FX rate service
2. `src/server/agents/auto_executor.py` - Auto-executor background task

**Modified:**
3. `src/server/my_fastapi_app/app/routes/payments.py` - Use real-time rates, add provider to response
4. `src/server/my_fastapi_app/app/services/mail_service.py` - Add provider to receipt, auto-execution email
5. `src/server/my_fastapi_app/app/main.py` - Start auto-executor on startup
6. `src/client/src/pages/BillScheduler.tsx` - Integrate Market Analysis and Route Comparison cards

---

## Configuration

**Add to `.env` (optional):**
```bash
# Auto-Executor Settings
AUTO_EXECUTE_CONFIDENCE_THRESHOLD=0.90  # 90% minimum
AUTO_EXECUTE_INTERVAL_MINUTES=15
```

---

## Troubleshooting

**Stripe webhook not receiving events:**
- Check `stripe listen` is running
- Verify webhook secret in .env matches terminal output
- Test with `stripe trigger checkout.session.completed`

**Routes agent returns no rates:**
- Router.py has fallbacks (returns default values)
- Check logs for API errors from Crebit/Wise/Remitly
- Settlement will use fallback rate (5.5) if needed

**Auto-executor not running:**
- Check backend logs for "🤖 Auto-executor: Starting"
- Verify confidence threshold not too high (try 0.70 for testing)
- Check agent graph runs successfully

**Email not sent:**
- SMTP configuration in .env
- Non-fatal - settlement still succeeds without email

---

**Ready to implement!** Follow steps 1-7 in order.
