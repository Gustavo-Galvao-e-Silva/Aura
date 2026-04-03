# Stablecoin Pipeline — Technical Design Document

## Purpose

This document describes the end-to-end payment pipeline that allows a Brazilian international student to pay a USD-denominated bill (e.g., university tuition) using BRL held in their Revellio wallet — without ever interacting directly with forex markets or cross-border wire infrastructure.

The pipeline converts value across four states:

```
Fiat BRL  →  Stable BRL (Mock-BRZ)  →  Stable USD (USDC)  →  Fiat USD
  (bank)        (Stellar testnet)        (Stellar testnet)      (wire)
```

Each transition is handled by a different external system. Revellio's PostgreSQL database acts as the authoritative ledger; the Stellar testnet and Circle sandbox provide blockchain proof and settlement simulation respectively.

---

## Design Philosophy

**Web2.5 Architecture** — balances and transaction state are stored in a trusted relational database (PostgreSQL), not on-chain. The blockchain is used as a proof layer and settlement rail, not as the primary data store. This is appropriate for a regulated fintech context where auditability, reversibility, and compliance matter more than censorship resistance.

**Financial System Principles enforced:**
1. `Wallet` = current state (always reflects the real balance)
2. `Transaction` = immutable history (append-only ledger, never updated or deleted)
3. `Checkout` = external lifecycle (tracks Stripe session from created → completed)
4. Webhooks must be idempotent (safe to receive the same event twice)
5. A balance can never change without a corresponding `Transaction` row

---

## The Four States of Value

### State 1 — Fiat BRL (Bank Account)

The user holds real Brazilian Reais in a bank account. This money never directly enters the Revellio system. Instead, the user deposits the equivalent amount into their Revellio wallet using Stripe.

In test mode, the Stripe Checkout page accepts test card `4242 4242 4242 4242`. No real bank account or real money is required.

**Responsible system:** Stripe (test mode)
**DB record created:** `checkouts` row + `wallets.usd_available` credit + `transactions` row

---

### State 2 — Stable BRL / Mock-BRZ (Stellar Testnet)

Once a deposit is confirmed, the equivalent amount is represented on-chain as **Mock-BRZ** — a custom asset issued on the Stellar testnet by Revellio's issuer account.

Mock-BRZ is a synthetic stand-in for a real BRL stablecoin such as BRZ (issued by Transfero) or MBRL (issued by Mercado Bitcoin). In production, this step would involve purchasing real BRZ from a licensed issuer.

On Stellar, assets are identified by a (code, issuer) pair:
- Code: `BRZ`
- Issuer: Revellio's testnet keypair (`STELLAR_SECRET_KEY`)

**Responsible system:** Stellar Horizon testnet
**Operation:** `Payment` (issuer → user's Stellar address, asset = BRZ, amount = brl_amount)
**DB record created:** `transactions` row with `asset = "BRL"`, `stellar_tx_id`

---

### State 3 — Stable USD / USDC (Stellar Testnet)

The Mock-BRZ is swapped for USDC on the Stellar testnet DEX (decentralized exchange). The conversion rate is the live BRL/USD FX rate fetched from the Revellio agent system.

USDC on Stellar testnet is issued by Circle's testnet account:
- Code: `USDC`
- Issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`

In the sandbox implementation this is simulated as a direct payment from the issuer account. In production this would be a **Path Payment Strict Send** operation which atomically routes through one or more liquidity pools to find the best rate.

**Responsible system:** Stellar Horizon testnet
**Operation:** `PathPayment` (BRZ → USDC, using DEX)
**DB record created:** `transactions` row with `asset = "USD"`, `stellar_tx_id`, `conversion_rate`

---

### State 4 — Fiat USD (Wire Transfer)

The USDC is redeemed for real USD via Circle's off-ramp API. Circle holds USDC in custody and initiates a wire transfer to the destination bank account (the university's account, in this case).

In the sandbox environment the Circle API simulates the wire transfer instantly. In production, wire transfers take 1–2 business days.

**Responsible system:** Circle (sandbox)
**Operation:** `POST /v1/transfers` → Circle converts USDC to USD and wires it to the destination
**DB record updated:** `transactions.circle_transfer_id`

---

## Full Pipeline Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          REVELLIO PIPELINE                               │
│                                                                          │
│  User (Brazil)          Backend              Stellar Testnet   Circle    │
│  ─────────────          ───────              ───────────────   ──────    │
│                                                                          │
│  1. User deposits BRL                                                    │
│     via Stripe ────────► POST /payments/checkout                         │
│     (test card)              │                                           │
│                              ▼                                           │
│                         Stripe Checkout Session created                  │
│                         Checkout row status = "created"                  │
│                              │                                           │
│  2. User pays on             │                                           │
│     Stripe page ─────────────┤                                           │
│                              │                                           │
│                         Stripe fires checkout.session.completed          │
│                              │                                           │
│                         POST /payments/webhook                           │
│                              │                                           │
│                         ┌────▼─────────────────────┐                    │
│                         │ Credit Wallet             │                    │
│                         │ usd_available += amount   │                    │
│                         │ Write Transaction (credit)│                    │
│                         │ Checkout → completed      │                    │
│                         └────────────────────────── ┘                   │
│                                                                          │
│  3. Aura agent recommends                                                │
│     "Pay Now" for a bill                                                 │
│                                                                          │
│  4. User confirms ─────► POST /payments/settle                           │
│                              │                                           │
│                         Verify balance ≥ cost                            │
│                         Fetch live FX rate                               │
│                              │                                           │
│                         ┌────▼─────────────────────┐                    │
│                         │ Stellar: Mint Mock-BRZ   │──► Testnet TX 1     │
│                         │ issuer → user account    │    (stellar_mint_tx)│
│                         └────────────────────────── ┘                   │
│                              │                                           │
│                         ┌────▼─────────────────────┐                    │
│                         │ Stellar: Swap BRZ→USDC   │──► Testnet TX 2     │
│                         │ via DEX / Path Payment   │    (stellar_swap_tx)│
│                         └────────────────────────── ┘                   │
│                              │                                           │
│                         ┌────▼─────────────────────┐                    │
│                         │ Circle: Off-ramp USDC    │──► Wire Transfer    │
│                         │ → USD wire to university │    (circle_id)      │
│                         └────────────────────────── ┘                   │
│                              │                                           │
│                         Debit Wallet                                     │
│                         usd_available -= cost                            │
│                         Write Transaction (debit)                        │
│                         Liability.is_paid = True                         │
│                              │                                           │
│  5. Email receipt ◄──────────┘                                           │
│     with all TX IDs                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1 — Fiat BRL → Wallet (Stripe)

### Entry point
`POST /payments/checkout`

### What happens
1. Backend calls `stripe.checkout.Session.create()` with `amount_usd`, `success_url`, `cancel_url`, and `metadata = {username, amount_usd}`
2. A `Checkout` row is written to PostgreSQL with `status = "created"`
3. The Stripe-hosted checkout URL is returned to the frontend
4. User completes payment on Stripe's page (test card `4242 4242 4242 4242`)
5. Stripe fires `checkout.session.completed` to the CLI listener
6. `POST /payments/webhook` receives the event:
   - Looks up the `Checkout` row by `stripe_checkout_session_id`
   - If already `completed`, returns early (idempotency)
   - Otherwise: credits `wallet.usd_available`, writes a `Transaction`, marks `Checkout.completed_at`

### Key data
| Field | Value |
|---|---|
| Stripe event | `checkout.session.completed` |
| Metadata | `{username, amount_usd}` |
| Wallet credit | `usd_available += amount_usd` |
| Transaction direction | `credit` |
| Transaction asset | `USD` |

### Idempotency mechanism
```python
if checkout and checkout.status == "completed":
    return {"received": True, "processed": False, "reason": "already_completed"}
```

---

## Step 2 — Stable BRL: Minting Mock-BRZ (Stellar)

### Entry point
`tools/stellar_tools.py → mint_mock_brz(user_public_key, amount_brl)`

### What happens
1. Revellio's issuer keypair (`STELLAR_SECRET_KEY`) signs a `Payment` operation
2. Destination: user's Stellar testnet address
3. Asset: `BRZ` issued by Revellio's testnet account
4. Amount: `amount_brl` (e.g., R$5,500 if paying a $1,000 bill at 5.5 BRL/USD)
5. Transaction is submitted to `https://horizon-testnet.stellar.org`
6. Stellar returns a transaction hash (`stellar_mint_tx`)

### Prerequisites
- User's Stellar account must exist (created via Friendbot if needed)
- User's Stellar account must have a **trustline** to `BRZ/issuer` — without it, the `Payment` operation fails with `op_no_trust`
- Issuer account must hold enough XLM for base fees

### Why trustlines exist
Stellar requires accounts to explicitly opt in to holding an asset. This prevents spam. In production, the user would establish the trustline via a wallet UI (e.g., Lobstr). In the sandbox, the backend can establish it programmatically using the user's keypair.

### Stellar operation
```
Payment {
  source:      REVELLIO_ISSUER_PUBLIC_KEY,
  destination: USER_STELLAR_PUBLIC_KEY,
  asset:       BRZ / REVELLIO_ISSUER_PUBLIC_KEY,
  amount:      "5500.00"
}
```

### Production equivalent
In production, minting BRZ would involve:
- Calling Transfero's API to purchase BRZ with fiat BRL
- BRZ arrives in Revellio's custody wallet
- Revellio forwards it to the user's wallet
- The user never interacts with the blockchain directly

---

## Step 3 — Stable BRL → Stable USD: Swapping BRZ for USDC (Stellar DEX)

### Entry point
`tools/stellar_tools.py → swap_brz_to_usdc(user_public_key, amount_brz, expected_rate)`

### What happens
1. The live BRL/USD FX rate is fetched from the Revellio agent system
2. Expected USDC output = `amount_brz / fx_rate` (e.g., R$5,500 / 5.5 = $1,000)
3. A `PathPaymentStrictSend` (or simplified direct payment in sandbox) is submitted to Stellar
4. Stellar's DEX finds a path through liquidity pools to convert BRZ → USDC atomically
5. USDC arrives in the user's Stellar account
6. Stellar returns a transaction hash (`stellar_swap_tx`)

### Slippage protection
A minimum receive amount is enforced: `min_usdc = expected_usdc * 0.98` (2% max slippage). If the DEX can't fill the order within this bound, the transaction fails and no BRZ is spent.

### Sandbox simplification
In the current sandbox, the swap is simulated as a direct payment from Revellio's issuer account rather than a true DEX path payment. This avoids the need to seed liquidity pools on testnet.

### Stellar operation (production)
```
PathPaymentStrictSend {
  source:        USER_STELLAR_PUBLIC_KEY,
  send_asset:    BRZ / REVELLIO_ISSUER,
  send_amount:   "5500.00",
  dest_asset:    USDC / GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5,
  dest_min:      "980.00",     # 2% slippage floor
  destination:   USER_STELLAR_PUBLIC_KEY,
  path:          []            # Stellar auto-discovers the route
}
```

### Why USDC on Stellar (not Ethereum)?
- Stellar has native DEX infrastructure with sub-second finality
- Stellar transaction fees are fractions of a cent (vs. Ethereum gas)
- Circle issues USDC natively on Stellar — no bridging required
- Stellar is well-suited to high-volume payment rails

---

## Step 4 — Stable USD → Fiat USD: Circle Off-Ramp

### Entry point
`tools/circle_tools.py → initiate_usdc_withdrawal(amount_usd, recipient_bank_account, user_metadata)`

### What happens
1. Revellio calls Circle's sandbox API `POST /v1/transfers`
2. Circle debits USDC from Revellio's hot wallet (`CIRCLE_USDC_HOT_WALLET`)
3. Circle initiates a USD wire transfer to the destination bank account (the university)
4. Circle returns a `transfer_id` and `status = "pending"`
5. In sandbox: transfer completes instantly. In production: 1–2 business days
6. Revellio polls `GET /v1/transfers/{transfer_id}` for status updates

### Request shape
```json
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
  "amount": { "amount": "1000.00", "currency": "USD" },
  "metadata": { "username": "cbahlis", "liability_id": "42" }
}
```

### Production requirements
Circle requires:
- Verified business account (KYB)
- AML/KYC on end users for transactions above $600
- Custody of USDC in a Circle account (not a self-custodied wallet)
- Idempotency keys on every request (UUID per transfer attempt)

---

## Database Writes Per Settlement

When `POST /payments/settle` completes successfully, the following DB changes are made atomically:

```
wallets
  usd_available  -= amount_usd (debit)
  total_spent_brl += amount_brl

transactions (row 1 — BRL debit)
  transaction_type = "payment"
  asset            = "BRL"
  direction        = "debit"
  amount           = amount_brl
  balance_before   = wallet balance before debit
  balance_after    = wallet balance after debit
  stellar_tx_id    = stellar_swap_tx
  circle_transfer_id = circle_transfer_id
  liability_id     = <bill id>
  conversion_rate  = fx_rate
  description      = "Paid USF Tuition ($1000.00) via stablecoin flow"

liabilities
  is_paid = True
```

---

## FX Rate Source

The conversion rate used to price `amount_brl = amount_usd * fx_rate` is sourced from the Revellio agent system, which aggregates:

- **BCB (Banco Central do Brasil)** — official Selic rate and Focus bulletin
- **FRED (Federal Reserve)** — Fed Funds rate and US CPI
- **Yahoo Finance** — real-time spot BRL/USD
- **Crebit / Wise / Remitly** — live transfer provider rates

The agent's market synthesis produces a `BULLISH / BEARISH / NEUTRAL` prediction with confidence and a thesis. The orchestrator uses this to recommend whether to convert now or wait for a better rate. The FX rate used for the actual conversion is the Crebit provider's live rate (typically most favourable for students).

---

## Error Handling and Rollback Strategy

Because Steps 2–4 involve external systems, partial failures are possible. The current strategy:

| Failure point | Consequence | Recovery |
|---|---|---|
| Stripe checkout never completed | No balance change | User retries checkout |
| Stellar mint fails | No BRZ issued, no USD spent | Retry `mint_mock_brz` |
| Stellar swap fails | BRZ held in user account, not yet USDC | Retry `swap_brz_to_usdc` |
| Circle transfer fails | USDC held in Revellio wallet, USD not yet wired | Retry Circle transfer |
| DB commit fails after Circle success | Circle wire sent, wallet not debited | Reconciliation job needed |

The DB commit is the last step in `settle_payment`. If it fails after the Circle transfer has been initiated, a reconciliation job (not yet implemented) would need to detect the mismatch and apply the debit manually.

In production, a **saga pattern** with compensating transactions would be used: each step records its result and can be individually retried or rolled back.

---

## Blockchain Audit Trail

Every settlement is anchored to the Stellar testnet via the Trust Engine:

1. The Aura agent generates a pay/wait recommendation with a reasoning string
2. The Trust Engine (`agents/trust.py`) hashes the full decision payload (including `fetched_at` timestamp) with SHA256
3. The hash is published to the Stellar testnet as a `ManageData` operation memo
4. The `stellar_tx_id` and `decision_hash` are stored in `audit_log`
5. The `/blockchain/verify/{identifier}` endpoint lets anyone verify a decision against the ledger

This means: not only is the money movement on-chain, but the AI reasoning that triggered the payment is also cryptographically locked and independently verifiable.

---

## What Is Sandbox vs. Production

| Component | Sandbox (current) | Production |
|---|---|---|
| Stripe | Test mode, card `4242 4242 4242 4242` | Live mode, real cards / PIX |
| Mock-BRZ | Custom testnet asset issued by Revellio | Real BRZ from Transfero or Mercado Bitcoin |
| USDC | Circle testnet USDC on Stellar testnet | Real USDC from Circle on Stellar mainnet |
| BRZ→USDC swap | Simulated direct payment from issuer | Stellar DEX path payment via liquidity pools |
| Circle off-ramp | Sandbox API, instant mock transfer | Production API, 1–2 business day wire |
| Stellar network | `testnet` (Horizon testnet) | `mainnet` (Horizon mainnet) |
| FX rate | Live rate from agent system | Same — agent system already uses live data |
| Key management | `.env` file | AWS Secrets Manager / HSM |
| User KYC | None | Required for Circle withdrawals > $600 |

To go from sandbox to production: update the Stellar network passphrase and Horizon URL, swap Stripe and Circle keys for production keys, replace Mock-BRZ with real BRZ, and add KYC verification before the first withdrawal.

---

## Files Involved

| File | Role |
|---|---|
| `src/server/db/models.py` | `Wallet`, `Checkout`, `Transaction` SQLAlchemy models |
| `src/server/alembic/versions/770d3084524c_...py` | Migration that created the three tables |
| `src/server/my_fastapi_app/app/routes/payments.py` | All four API endpoints |
| `src/server/my_fastapi_app/app/settings.py` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `src/server/tools/stellar_tools.py` | `mint_mock_brz`, `swap_brz_to_usdc` (to be created) |
| `src/server/tools/circle_tools.py` | `initiate_usdc_withdrawal` (to be created) |
| `src/client/src/pages/Wallet.tsx` | Frontend wallet UI |
| `src/client/src/API/PaymentsClient.ts` | Frontend API client |
| `src/client/src/components/Navbar.tsx` | Wallet nav tab |
| `src/client/src/main.tsx` | `/wallet` route registration |
