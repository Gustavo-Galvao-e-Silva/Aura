# Settlement Flow Testing Guide

**Date:** 2026-04-01
**Purpose:** Quick guide to test the complete stablecoin settlement flow (Phase 2 Step 2.5)

---

## What You're Testing

The **END-TO-END STABLECOIN PAYMENT FLOW**:

```
User → Pay Bill → BRL → Mock-BRZ → USDC → Mark Paid → Email Receipt
```

This is the magic that happens when a user clicks "Pay Now" on a bill!

---

## Prerequisites

✅ Backend running (Step 4.1 from TEST_PLAN_PHASE_1_2.md)
✅ Stellar tools working (tested in Phase 2.3)
✅ Database populated with test data

---

## Quick Test (5 minutes)

### Step 1: Create Test User with BRL Balance

**Option A: Use existing test user (if you have one)**

**Option B: Create via database (quickest)**

```bash
# Connect to database
docker exec -it server-db-1 psql -U postgres

# Create user
INSERT INTO users (fullname, username, email)
VALUES ('Test Student', 'testuser', 'test@example.com')
ON CONFLICT DO NOTHING;

# Create wallet with BRL balance
INSERT INTO wallets (username, brl_available, usd_available, brl_pending, total_deposited_brl, total_spent_brl)
VALUES ('testuser', 50000.0, 0.0, 0.0, 50000.0, 0.0)
ON CONFLICT (username) DO UPDATE SET brl_available = 50000.0;

\q
```

---

### Step 2: Create Unpaid Liability (Bill)

```bash
curl -X POST http://localhost:8000/expenses/create \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "name": "USF Spring Tuition 2026",
    "amount": 1000.0,
    "currency": "USD",
    "due_date": "2026-05-01",
    "category": "Education"
  }'
```

**Expected response:**
```json
{
  "id": 1,
  "username": "testuser",
  "name": "USF Spring Tuition 2026",
  "amount": 1000.0,
  ...
  "is_paid": false
}
```

**Save the `id` - you'll need it for the next step!**

---

### Step 3: Trigger Settlement Flow 🚀

```bash
curl -X POST http://localhost:8000/payments/settle \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "liability_id": 1
  }' | jq .
```

**What happens behind the scenes:**
1. ✅ Verifies user has R$5,500.00 BRL (for $1,000 bill at 5.5 rate)
2. ✅ Creates ephemeral Stellar account via Friendbot
3. ✅ Mints R$5,500.00 Mock-BRZ **on real Stellar testnet** 🌟
4. ✅ Swaps Mock-BRZ → USDC (mock mode)
5. ✅ Debits R$5,500.00 from wallet
6. ✅ Marks liability as paid
7. ✅ Creates transaction record with blockchain proof
8. ✅ Sends email receipt (if SMTP configured)

**Expected response:**
```json
{
  "status": "success",
  "message": "Successfully paid USF Spring Tuition 2026 using stablecoin flow",
  "liability_id": 1,
  "liability_name": "USF Spring Tuition 2026",
  "amount_usd": 1000.0,
  "amount_brl_spent": 5500.0,
  "fx_rate": 5.5,
  "stellar_mint_tx": "7309ca89e83f480ac04cf34269e07b5706e5083c9ca90c635d9875d1e7c428cd",
  "stellar_swap_tx": "mock_swap_e3368df6a7dea3a8de1d50c75f372c49e5d4c0f1659442ff1242d70298a95045",
  "database_transaction_id": 1,
  "new_balance_brl": 44500.0,
  "new_balance_usd": 0.0
}
```

**🎉 If you see this response, the settlement flow WORKS!**

---

### Step 4: Verify Blockchain Proof

**Click the Stellar Explorer link:**
```
https://stellar.expert/explorer/testnet/tx/[stellar_mint_tx]
```

**You should see:**
- ✅ Payment operation from Revellio issuer account
- ✅ Asset: **BRZ** (Mock-BRZ)
- ✅ Amount: **5500** (the exact BRL amount)
- ✅ Destination: Random Stellar account (ephemeral)
- ✅ Status: **SUCCESS**

**This is REAL blockchain proof!** 🌟

The swap transaction is mock mode (look for "mock_swap_" prefix), which is expected for MVP.

---

### Step 5: Verify Database Changes

**Check liability is marked as paid:**
```bash
curl http://localhost:8000/status | jq '.pending_liabilities[] | select(.id == 1)'
```

**Should return nothing** (liability is paid, not pending anymore!)

**Check wallet balance:**
```bash
curl http://localhost:8000/payments/balance/testuser | jq .
```

**Expected:**
```json
{
  "username": "testuser",
  "brl_available": 44500.0,  // ← Decreased by 5500.0
  "usd_available": 0.0,
  "brl_pending": 0.0,
  "total_deposited_brl": 50000.0,
  "total_spent_brl": 5500.0  // ← Increased by 5500.0
}
```

**Check transaction history:**
```bash
curl http://localhost:8000/payments/history/testuser | jq '.[0]'
```

**Expected:**
```json
{
  "id": 1,
  "created_at": "2026-04-01T...",
  "transaction_type": "payment",
  "status": "completed",
  "asset": "BRL",
  "direction": "debit",
  "amount": 5500.0,
  "balance_before": 50000.0,
  "balance_after": 44500.0,
  "description": "Paid USF Spring Tuition 2026 ($1000.00) via stablecoin flow",
  ...
}
```

---

### Step 6: Check Email (If SMTP Configured)

If you have SMTP configured in your `.env`, check the email for:

**Subject:** `Payment Confirmed: USF Spring Tuition 2026`

**Body includes:**
- ✅ Payment details (bill name, amounts, FX rate)
- ✅ Clickable Stellar Explorer links
- ✅ Database transaction ID

---

## Success Criteria

✅ Settlement endpoint returns `"status": "success"`
✅ Stellar Explorer shows real Mock-BRZ mint transaction
✅ Wallet BRL balance decreased by correct amount
✅ Liability marked as `is_paid: true`
✅ Transaction record created with blockchain proof in metadata
✅ Email sent (if SMTP configured)

**If all checks pass: PHASE 2 STEP 2.5 IS COMPLETE!** 🎉

---

## Troubleshooting

### Error: "Insufficient BRL balance"
- **Fix:** Increase wallet BRL balance in database (Step 1 Option B)

### Error: "User not found"
- **Fix:** Create user in database first (Step 1 Option B)

### Error: "Liability not found"
- **Fix:** Verify liability was created (Step 2), check the ID matches

### Error: "Failed to create Stellar account"
- **Fix:** Friendbot might be rate-limited, wait 30 seconds and retry

### Error: "Failed to mint Mock-BRZ"
- **Fix:** Verify `STELLAR_MOCK_BRZ_ISSUER` is configured in `.env`
- **Fix:** Check issuer account is funded (10,000 XLM)

### No email received
- **Expected:** If SMTP is not configured, endpoint still succeeds
- **Fix:** Check SMTP settings in `.env` if you need emails

---

## What's Next?

After verifying the settlement flow works:

1. **Test with multiple bills:** Create 2-3 different liabilities and pay them sequentially
2. **Test insufficient balance:** Try to pay a $10,000 bill with only R$5,000 balance (should fail gracefully)
3. **Frontend integration:** Add "Pay Now" button to Bill Scheduler UI
4. **Phase 3 (optional):** Polish remaining endpoints to surface transaction IDs

---

## Architecture Summary

**What you just tested:**

```
┌──────────────────────────────────────────────────────────┐
│                  REVELLIO STABLECOIN FLOW                │
└──────────────────────────────────────────────────────────┘

1. Web2 Layer (PostgreSQL)
   - Wallet: BRL balance tracking
   - Liability: Bill payment status
   - Transaction: Immutable ledger

2. Web2.5 Layer (Stellar Blockchain)
   - Mock-BRZ mint: REAL transaction ✅
   - USDC swap: MOCK transaction ⚠️ (for MVP)

3. Communication Layer
   - Email: Payment receipts with blockchain proof
   - API: RESTful endpoints for frontend

Database = Source of Truth
Blockchain = Proof Layer (auditable, immutable)
```

**This is a Web2.5 architecture:** Traditional database for speed/UX + blockchain for proof/trust! 🚀

---

## Congratulations!

If you've reached this point with all tests passing, you've successfully implemented:

✅ Complete stablecoin payment pipeline
✅ Real blockchain integration (Stellar testnet)
✅ Double-entry accounting (wallet + transaction ledger)
✅ Email notifications with proof
✅ End-to-end Web2.5 architecture

**PHASE 2 IS COMPLETE!** 🎊

You can now pay international bills using BRL → Mock-BRZ → USDC flow, with every transaction provably recorded on the Stellar blockchain!
