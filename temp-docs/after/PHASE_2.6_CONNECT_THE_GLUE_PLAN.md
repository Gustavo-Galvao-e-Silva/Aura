# Phase 2.6: Connect the Glue - Implementation Plan

**Date:** 2026-04-01
**Status:** 📋 AWAITING APPROVAL
**Goal:** Connect Agentic Brain → Settlement Flow for true "Agentic FX Exchange"

---

## Executive Summary

**What we're building:**
1. **Phase 2.6.1** - Manual trigger (connect "Pay Bill" buttons to `/payments/settle`)
2. **Phase 2.6.2** - Hybrid auto-execute (high confidence = auto, medium = manual, low = track)
3. **Phase 2.6.3** - Stripe webhook setup for local development

**Path:** Option 1 → Option 3 (incremental)

**Estimated Time:**
- Phase 2.6.1: 1 hour (manual buttons)
- Phase 2.6.2: 2 hours (hybrid logic)
- Phase 2.6.3: 30 minutes (Stripe setup)
- **Total: ~3.5 hours**

---

## Current State

### What Works ✅
- Agentic brain analyzes markets (`/agents/status`)
- Orchestrator decides "pay now" or "wait"
- Settlement endpoint executes stablecoin flow (`/payments/settle`)
- Frontend shows beautiful UI with recommendations

### What's Missing ❌
- "Pay Bill" buttons have no onClick handler
- No connection between agents and settlement
- No auto-execution logic
- Stripe webhook not set up for local dev

### The Gap
```
┌──────────────┐         ┌──────────────┐
│   Agents     │         │  Settlement  │
│  (Phase 1)   │    ❌   │  (Phase 2)   │
│              │         │              │
│ "Pay Now!" ──┼────X────┼→ BRL→USDC   │
└──────────────┘         └──────────────┘
     ↓ ❌                      ↑
   Frontend               No trigger!
  (no onClick)
```

---

## Phase 2.6.1: Manual Trigger (Option 1)

**Goal:** User clicks "Pay Bill" → Settlement executes

**Time:** 1 hour

### Files to Modify

#### 1. Frontend: `src/client/src/pages/BillScheduler.tsx`

**Changes:**

**A. Add state for payment processing**
```typescript
// After line 107 (existing state)
const [processingPayment, setProcessingPayment] = useState<number | null>(null);
const [paymentError, setPaymentError] = useState<string | null>(null);
```

**B. Add payment handler function**
```typescript
// After line 108 (after existing state)
async function handlePayBill(bill: ScheduledBill) {
  setProcessingPayment(bill.id);
  setPaymentError(null);

  try {
    const response = await fetch('http://localhost:8000/payments/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'testuser',  // TODO: Get from auth context later
        liability_id: bill.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Payment failed');
    }

    const result = await response.json();

    // Show success message
    alert(
      `✅ Payment successful!\n\n` +
      `Paid: ${bill.name}\n` +
      `Amount: $${result.amount_usd} USD (R$${result.amount_brl_spent} BRL)\n` +
      `FX Rate: ${result.fx_rate}\n\n` +
      `Stellar Transaction: ${result.stellar_mint_tx.slice(0, 10)}...\n\n` +
      `Check your email for receipt!`
    );

    // Refresh status to show updated data
    fetchStatus();
  } catch (error) {
    console.error('Payment error:', error);
    setPaymentError(error instanceof Error ? error.message : 'Unknown error');
    alert(`❌ Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setProcessingPayment(null);
  }
}
```

**C. Update button onClick (Desktop view - around line 539)**
```typescript
// Replace existing button (lines 539-548)
<button
  className="rounded-xl px-4 py-2 text-xs font-bold transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
  style={{ background: C.rose, color: C.bg }}
  onClick={() => {
    if (bill.recommendation === "Pay Now") {
      handlePayBill(bill);
    } else {
      // TODO: Implement schedule/track logic later
      alert('Schedule/Track functionality coming soon!');
    }
  }}
  disabled={processingPayment === bill.id}
>
  {processingPayment === bill.id
    ? "Processing..."
    : bill.recommendation === "Pay Now"
      ? "Pay Bill"
      : bill.recommendation === "Wait"
        ? "Schedule"
        : "Track Rate"}
</button>
```

**D. Update button onClick (Mobile view - around line 632)**
```typescript
// Same changes for mobile button
<button
  className="mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
  style={{ background: C.rose, color: C.bg }}
  onClick={() => {
    if (bill.recommendation === "Pay Now") {
      handlePayBill(bill);
    } else {
      alert('Schedule/Track functionality coming soon!');
    }
  }}
  disabled={processingPayment === bill.id}
>
  {processingPayment === bill.id
    ? "Processing..."
    : bill.recommendation === "Pay Now"
      ? "Pay Bill"
      : bill.recommendation === "Wait"
        ? "Schedule"
        : "Track Rate"}
</button>
```

### Testing Plan

**Prerequisites:**
1. User with BRL balance in wallet
2. Unpaid liability in database
3. Backend running on localhost:8000

**Test Flow:**
```bash
# 1. Start backend
cd src/server
# (backend should be running)

# 2. Start frontend
cd src/client
npm run dev

# 3. Navigate to Bill Scheduler
http://localhost:5173/bill-scheduler

# 4. Click "Pay Bill" on a "Pay Now" recommendation
# Expected:
# - Button shows "Processing..."
# - Alert shows success with transaction details
# - Email sent to user
# - Bill disappears from list (now paid)
```

**Success Criteria:**
- ✅ Button triggers payment
- ✅ Loading state shows
- ✅ Success alert with blockchain proof
- ✅ Email received
- ✅ Frontend refreshes showing updated status

---

## Phase 2.6.2: Hybrid Auto-Execute (Option 3)

**Goal:** High confidence → auto-pay, medium → manual, low → track

**Time:** 2 hours

### Architecture

**Confidence Thresholds:**
- **≥90%** → Auto-execute + notify
- **70-89%** → Show "Pay Bill" button (manual)
- **<70%** → Show "Track Rate" (monitor only)

**Auto-execution trigger:**
- Background task runs every 15 minutes
- Checks for high-confidence "pay now" decisions
- Executes settlement automatically
- Sends notification email

### Files to Create/Modify

#### 1. New File: `src/server/agents/auto_executor.py`

**Purpose:** Background service that auto-executes high-confidence payments

```python
"""
Autonomous payment executor for high-confidence decisions.

This module runs as a background task and automatically executes
payments when the agentic brain has high confidence (≥90%).
"""

from datetime import datetime, timedelta
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

    This function:
    1. Runs the agent graph to get current decisions
    2. Filters for high-confidence (≥90%) "pay now" recommendations
    3. Auto-executes those payments via settlement flow
    4. Sends notification emails
    """
    print(f"🤖 Auto-executor: Checking for high-confidence payments...")

    async with AsyncSessionLocal() as db:
        try:
            # Get all users (TODO: optimize for scale)
            result = await db.execute(select(Users))
            users = result.scalars().all()

            total_executed = 0

            for user in users:
                # Run agent graph for this user
                state = AuraState(username=user.username)
                agent_result = await agent_graph.ainvoke(state)

                # Check each decision
                for decision in agent_result.get("payment_decisions", []):
                    confidence = decision.get("market_confidence", 0.0)
                    should_pay = decision.get("pay", False)
                    is_predicted = decision.get("is_predicted", False)
                    liability_id = decision.get("liability_id")

                    # Auto-execute if:
                    # - High confidence (≥90%)
                    # - Agent says "pay now"
                    # - Not a predicted expense (confirmed only)
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

                            try:
                                # Execute settlement
                                settlement_result = await settle_payment(
                                    payment=SettlementRequest(
                                        username=user.username,
                                        liability_id=liability_id
                                    ),
                                    db=db
                                )

                                # Send notification
                                send_auto_execution_notification(
                                    to_email=user.email,
                                    username=user.username,
                                    liability_name=liability.name,
                                    amount_usd=settlement_result.amount_usd,
                                    confidence=confidence,
                                    reason=decision.get("reason", "Market conditions optimal"),
                                    stellar_mint_tx=settlement_result.stellar_mint_tx,
                                    stellar_swap_tx=settlement_result.stellar_swap_tx
                                )

                                total_executed += 1
                                print(f"      ✅ Auto-executed successfully!")

                            except Exception as e:
                                print(f"      ❌ Auto-execution failed: {e}")

            print(f"🤖 Auto-executor: Completed. Executed {total_executed} payment(s)")

        except Exception as e:
            print(f"❌ Auto-executor error: {e}")


async def auto_executor_loop():
    """
    Background loop that runs the auto-executor periodically.

    This is started as a FastAPI background task on startup.
    """
    print(f"🤖 Auto-executor: Starting (checking every {AUTO_EXECUTE_INTERVAL_MINUTES} minutes)")

    while True:
        try:
            await check_and_execute_high_confidence_payments()
        except Exception as e:
            print(f"❌ Auto-executor loop error: {e}")

        # Wait before next check
        await asyncio.sleep(AUTO_EXECUTE_INTERVAL_MINUTES * 60)
```

#### 2. Modify: `src/server/my_fastapi_app/app/main.py`

**Add background task on startup:**

```python
# After existing imports
from agents.auto_executor import auto_executor_loop
import asyncio

# In the startup event
@app.on_event("startup")
async def startup_event():
    print("🚀 Revellio Backend: Startup event triggered")

    # ... existing startup code ...

    # Start auto-executor background task
    print("🤖 Starting autonomous payment executor...")
    asyncio.create_task(auto_executor_loop())

    print("🚀 Revellio Backend: Startup complete!")
```

#### 3. New Email Function: `src/server/my_fastapi_app/app/services/mail_service.py`

**Add notification for auto-executed payments:**

```python
def send_auto_execution_notification(
    to_email: str,
    username: str,
    liability_name: str,
    amount_usd: float,
    confidence: float,
    reason: str,
    stellar_mint_tx: str,
    stellar_swap_tx: str,
):
    """
    Send notification when Aura auto-executes a payment.

    Different from receipt email - this explains WHY it was auto-executed.
    """
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_password = settings.SMTP_PASSWORD
    from_email = settings.from_email

    if not smtp_host or not smtp_user or not smtp_password:
        print("⚠️  SMTP not configured - skipping email")
        return

    subject = f"🤖 Aura Auto-Paid: {liability_name}"

    mint_link = f"https://stellar.expert/explorer/testnet/tx/{stellar_mint_tx}"

    body = f"""
Hello @{username},

Aura has automatically paid your bill based on optimal market conditions!

PAYMENT DETAILS:
- Bill: {liability_name}
- Amount: ${amount_usd:.2f} USD
- Confidence: {confidence:.1%}
- Reason: {reason}

WHY AURA PAID NOW:
Aura detected highly favorable exchange rates and determined this was the
optimal time to execute your payment. This decision was made with {confidence:.1%}
confidence based on current market analysis.

BLOCKCHAIN PROOF:
{mint_link}

You can view the full transaction details in your Wallet or Audit page.

No action needed - your bill has been successfully paid!

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

#### 4. Frontend: Update to show auto-executed payments

**Modify:** `src/client/src/pages/BillScheduler.tsx`

**Add indicator for auto-executed payments:**
```typescript
// In the bill card, add badge if payment was auto-executed
{bill.wasAutoExecuted && (
  <span
    className="px-2 py-1 text-xs font-semibold rounded"
    style={{
      background: "rgba(139,92,246,0.15)",
      color: "#8b5cf6"
    }}
  >
    🤖 Auto-Paid by Aura
  </span>
)}
```

### Configuration

**Add to `.env`:**
```bash
# Auto-Executor Settings
AUTO_EXECUTE_ENABLED=true
AUTO_EXECUTE_CONFIDENCE_THRESHOLD=0.90  # 90% minimum
AUTO_EXECUTE_INTERVAL_MINUTES=15
```

### Testing Plan

**Test Auto-Execution:**
```bash
# 1. Create liability with urgent due date
curl -X POST http://localhost:8000/expenses/create \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "name": "Urgent Bill",
    "amount": 100.0,
    "currency": "USD",
    "due_date": "2026-04-03",  # 2 days from now
    "category": "Education"
  }'

# 2. Ensure market conditions are BULLISH
# - Agents should recommend "Pay Now" with high confidence

# 3. Wait for auto-executor (max 15 minutes)
# - Check logs for "🤖 Auto-executing payment..."

# 4. Verify:
# - Payment executed automatically
# - Email notification sent
# - Bill marked as paid
# - Frontend shows "🤖 Auto-Paid by Aura"
```

**Test Manual Execution (medium confidence):**
```bash
# 1. Create liability with medium urgency
# 2. Agents should recommend "Pay Now" with 70-89% confidence
# 3. Auto-executor should NOT execute
# 4. User must click "Pay Bill" manually
```

---

## Phase 2.6.3: Stripe Webhook Setup

**Goal:** Enable Stripe webhook forwarding for local development

**Time:** 30-45 minutes (depending on option chosen)

---

### Architecture Decision: Where Does Stripe CLI Run?

**Current plan:** Stripe CLI runs on **HOST machine**, forwards to Docker container

**You have two options:**

#### Option A: Stripe CLI on Host (SIMPLER - Recommended)
```
┌─────────────────────────────────────────────┐
│  Host Machine                               │
│                                             │
│  stripe listen --forward-to localhost:8000 │
│                ↓                            │
│         localhost:8000 (exposed port)       │
│                ↓                            │
│  ┌──────────────────────────────────────┐  │
│  │  Docker Container                    │  │
│  │  Backend: 0.0.0.0:8000               │  │
│  │  /payments/webhook endpoint          │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Pros:**
- ✅ Simple setup
- ✅ Standard Stripe CLI approach
- ✅ Easy to start/stop independently
- ✅ No Dockerfile changes needed

**Cons:**
- ❌ Requires Stripe CLI installed on host
- ❌ Must run manually each time

---

#### Option B: Stripe CLI in Container (FULLY CONTAINERIZED)
```
┌────────────────────────────────────────────────┐
│  Docker Compose                                │
│                                                │
│  ┌──────────────┐      ┌──────────────────┐   │
│  │  stripe-cli  │ ───> │  backend         │   │
│  │  container   │      │  /payments/      │   │
│  │              │      │  webhook         │   │
│  └──────────────┘      └──────────────────┘   │
└────────────────────────────────────────────────┘
```

**Pros:**
- ✅ Fully containerized (no host dependencies)
- ✅ Starts automatically with `docker-compose up`
- ✅ Team members just run `docker-compose up`

**Cons:**
- ❌ More complex setup
- ❌ Requires Stripe API key in environment
- ❌ Authentication flow more complex

---

### Quick Comparison

| Aspect | Option A (Host) | Option B (Container) |
|--------|----------------|---------------------|
| **Setup complexity** | Simple | Moderate |
| **Team onboarding** | Manual steps | Just `docker-compose up` |
| **Maintenance** | Manual restart needed | Auto-restarts |
| **Debugging** | Easier (separate terminal) | Mixed with container logs |
| **Dependencies** | Requires host CLI | No host dependencies |
| **Best for** | Solo dev, quick testing | Team dev, production-like |

**Recommendation:** Start with **Option A** for MVP, switch to **Option B** when deploying or onboarding teammates.

---

### Option A Implementation (Recommended for MVP)

#### 1. Install Stripe CLI on Host

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.5/stripe_1.19.5_linux_x86_64.tar.gz
tar -xvf stripe_1.19.5_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

#### 2. Login to Stripe (one-time)

```bash
stripe login
# Follow browser authentication flow
```

#### 3. Start Webhook Forwarding

**Command:**
```bash
# Run this each time you start development
stripe listen --forward-to http://localhost:8000/payments/webhook
```

**Expected output:**
```
> Ready! Your webhook signing secret is whsec_abc123... (^C to quit)
```

**Copy the webhook secret and add to `.env`:**
```bash
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

---

### Option B Implementation (Fully Containerized)

**If you want everything in Docker:**

#### 1. Add Stripe CLI Service to `docker-compose.yml`

**File:** `src/server/docker-compose.yml`

```yaml
# Add this service alongside existing backend/db services
services:
  # ... existing services ...

  stripe-cli:
    image: stripe/stripe-cli:latest
    container_name: revellio-stripe-cli
    command: listen --forward-to http://backend:8000/payments/webhook --api-key ${STRIPE_SECRET_KEY}
    environment:
      - STRIPE_API_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_DEVICE_NAME=revellio-local-dev
    networks:
      - revellio-network
    depends_on:
      - backend
    restart: unless-stopped

# Make sure network exists
networks:
  revellio-network:
    driver: bridge
```

#### 2. Update `.env` with Stripe API Key

```bash
# .env file
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_will_be_generated_in_logs
```

#### 3. Start with Docker Compose

```bash
docker-compose up -d
```

#### 4. Get Webhook Secret from Logs

```bash
# Check stripe-cli logs for webhook secret
docker logs revellio-stripe-cli

# Look for line like:
# > Ready! Your webhook signing secret is whsec_abc123...

# Copy that secret to .env
```

#### 5. Update Backend Service

**Ensure backend service is on same network:**

```yaml
services:
  backend:
    # ... existing config ...
    networks:
      - revellio-network
    environment:
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
```

**Benefits of Option B:**
- ✅ Run `docker-compose up` and everything works
- ✅ No manual Stripe CLI management
- ✅ Webhook forwarding starts automatically
- ✅ Easier for teammates to onboard

**Drawbacks:**
- ❌ Webhook secret changes on restart (need to update .env)
- ❌ Logs mixed with other container logs
- ❌ Slightly more complex debugging

#### 4. Create systemd service (optional - for persistent forwarding)

**File:** `~/revellio-stripe-webhook.service`

```ini
[Unit]
Description=Stripe Webhook Forwarding for Revellio
After=network.target

[Service]
Type=simple
User=horyzon
WorkingDirectory=/home/horyzon
ExecStart=/usr/local/bin/stripe listen --forward-to http://localhost:8000/payments/webhook
Restart=always

[Install]
WantedBy=multi-user.target
```

**Install:**
```bash
sudo cp ~/revellio-stripe-webhook.service /etc/systemd/system/
sudo systemctl enable revellio-stripe-webhook
sudo systemctl start revellio-stripe-webhook
```

#### 5. Test Webhook

**Trigger test event:**
```bash
stripe trigger checkout.session.completed
```

**Expected:**
- Backend logs show: `📨 Stripe webhook: checkout.session.completed`
- Wallet credited (if metadata includes valid username)

### Testing Checklist

- [ ] Stripe CLI installed
- [ ] Logged into Stripe
- [ ] Webhook forwarding running
- [ ] STRIPE_WEBHOOK_SECRET configured in `.env`
- [ ] Test event triggered successfully
- [ ] Backend receives and processes webhook

---

## Frontend: Fix Audit Page Network Display

**Goal:** Show "Stellar Testnet" instead of "Base Sepolia"

**Time:** 5 minutes

### File to Modify

**`src/client/src/pages/Audit.tsx`**

**Change mock data (lines 49-100):**
```typescript
// Replace all instances of:
network: "Base Sepolia"

// With:
network: "Stellar Testnet"
```

**Eventually (when connected to real backend):**
```typescript
// Fetch from API instead of mock data
const [decisions, setDecisions] = useState<TrustDecision[]>([]);

useEffect(() => {
  fetch('http://localhost:8000/blockchain/audit_log')  // TODO: Create this endpoint
    .then(res => res.json())
    .then(data => setDecisions(data));
}, []);
```

---

## Implementation Order

**Session 1 (Phase 2.6.1 - Manual Buttons):**
1. Modify `BillScheduler.tsx` - Add onClick handlers
2. Test manual payment flow
3. Document results

**Session 2 (Phase 2.6.2 - Hybrid Auto-Execute):**
1. Create `auto_executor.py`
2. Add auto-execution notification email
3. Modify `main.py` to start background task
4. Test auto-execution with high confidence
5. Test manual flow with medium confidence

**Session 3 (Phase 2.6.3 - Stripe Setup):**
1. Set up Stripe CLI
2. Configure webhook forwarding
3. Test deposit → wallet credit flow

**Session 4 (Cleanup):**
1. Fix Audit page to show "Stellar Testnet"
2. Update documentation
3. Create end-to-end testing guide

---

## Success Criteria

### Phase 2.6.1 Complete When:
- ✅ "Pay Bill" button triggers settlement
- ✅ Success alert shows with blockchain proof
- ✅ Email receipt sent
- ✅ Frontend refreshes showing updated status

### Phase 2.6.2 Complete When:
- ✅ Auto-executor runs every 15 minutes
- ✅ High confidence (≥90%) payments auto-execute
- ✅ Medium confidence (70-89%) require manual click
- ✅ Low confidence (<70%) show "Track Rate"
- ✅ Auto-execution notification emails sent
- ✅ Logs show "🤖 Auto-executed successfully!"

### Phase 2.6.3 Complete When:
- ✅ Stripe CLI forwarding webhooks
- ✅ Test deposit credits wallet
- ✅ Webhook signature verification works

---

## Risks & Mitigations

### Risk 1: Auto-executor executes duplicate payments
**Mitigation:**
- Check `is_paid` flag before executing
- Use database transactions for atomicity
- Add idempotency key to settlement flow

### Risk 2: High confidence threshold too aggressive
**Mitigation:**
- Start with 90% threshold (conservative)
- Monitor for 1 week
- Adjust based on user feedback

### Risk 3: Email spam if auto-executor fails
**Mitigation:**
- Rate limit emails (max 1 per liability)
- Add cooldown period between auto-execution attempts
- Log failures instead of retrying immediately

### Risk 4: SMTP not configured
**Mitigation:**
- All email functions gracefully skip if SMTP missing
- Payments still succeed
- Frontend shows status regardless

---

## Questions for Approval

1. **Auto-execution interval:** 15 minutes good, or should it be different?
2. **Confidence thresholds:** 90% for auto, 70% for manual - adjust?
3. **Notification preferences:** Email only, or add in-app notifications?
4. **Rate limiting:** Max auto-executions per day/hour?
5. **Stripe webhook setup:** Which option?
   - **Option A:** Run `stripe listen` on host (simpler, recommended for MVP)
   - **Option B:** Add stripe-cli container to docker-compose (fully containerized)
   - **Option C:** Skip for now, test with manual Stripe API calls

---

## Documentation Updates Needed

After implementation:
1. Update `SETTLEMENT_FLOW_TEST_GUIDE.md` with auto-execution testing
2. Create `AUTO_EXECUTOR_GUIDE.md` explaining hybrid logic
3. Update `STABLECOIN_INTEGRATION_PLAN_v4_LOG.md` with Phase 2.6
4. Add frontend integration guide for future developers

---

## Status: 📋 AWAITING YOUR APPROVAL

**Ready to implement when you approve:**
- [ ] Phase 2.6.1 scope and approach
- [ ] Phase 2.6.2 confidence thresholds and logic
- [ ] Phase 2.6.3 Stripe webhook setup method
- [ ] Implementation order
- [ ] Any adjustments to the plan

---

_Created: 2026-04-01_
_Awaiting approval to proceed_
