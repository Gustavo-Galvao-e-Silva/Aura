# Stripe Integration — Implementation Docs

## Overview

Revellio uses Stripe Checkout (hosted payment page) to accept deposits into a user's wallet. The flow is entirely test-mode and requires no real money. After a payment completes, a Stripe webhook credits the user's `Wallet` record and writes an immutable `Transaction` row.

---

## Architecture

```
Frontend (Wallet.tsx)
  │
  │  POST /payments/checkout
  ▼
Backend (payments.py)  ──→  Stripe API (creates Checkout Session)
  │                              │
  │  stores Checkout row         │  user completes payment on
  │  status = "created"          │  Stripe hosted page
  ▼                              ▼
PostgreSQL                  Stripe fires checkout.session.completed
  │                              │
  │                    stripe listen forwards to
  │                              │
  │                    POST /payments/webhook
  │                              │
  └──────────────────────────────┘
         credits Wallet, writes Transaction,
         marks Checkout status = "completed"
```

---

## Database Schema

Three new tables were added via Alembic migration `770d3084524c`.

### `wallets`
Current financial state — one row per user.

| Column | Type | Description |
|---|---|---|
| `id` | integer PK | |
| `username` | string FK → users | |
| `usd_available` | float | Spendable USD balance |
| `brl_available` | float | BRL balance (reserved for future stablecoin flow) |
| `brl_pending` | float | Deposit initiated but webhook not yet confirmed |
| `total_deposited_brl` | float | Running total of all deposits |
| `total_spent_brl` | float | Running total of all payments |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated on write |

### `checkouts`
Tracks a Stripe Checkout Session from creation through completion. Enables idempotent webhook handling — if Stripe delivers an event twice, the `status = "completed"` check prevents double-crediting.

| Column | Type | Description |
|---|---|---|
| `id` | integer PK | |
| `username` | string FK → users | |
| `provider` | string | Always `"stripe"` |
| `purpose` | string | Always `"wallet_topup"` |
| `status` | string | `created` → `completed` / `expired` / `cancelled` |
| `currency` | string(3) | `"USD"` |
| `amount` | float | Amount in USD |
| `stripe_checkout_session_id` | string UNIQUE | `cs_test_...` |
| `stripe_payment_intent_id` | string UNIQUE | `pi_...` (set by webhook) |
| `metadata_json` | JSON | Arbitrary context |
| `created_at` | timestamptz | |
| `completed_at` | timestamptz | Set by webhook on completion |

### `transactions`
Immutable double-entry ledger. Every balance change produces one row here. Rows are never updated or deleted.

| Column | Type | Description |
|---|---|---|
| `id` | integer PK | |
| `username` | string FK → users | |
| `wallet_id` | integer FK → wallets | |
| `checkout_id` | integer FK → checkouts | |
| `liability_id` | integer FK → liabilities | For future payment flow |
| `transaction_type` | string | `deposit` / `payment` / `refund` / `conversion` |
| `status` | string | `completed` / `pending` / `failed` |
| `asset` | string | `USD` or `BRL` |
| `direction` | string | `credit` (balance up) / `debit` (balance down) |
| `amount` | float | Absolute amount |
| `balance_before` | float | Wallet balance snapshot before this TX |
| `balance_after` | float | Wallet balance snapshot after this TX |
| `stripe_event_id` | string | `evt_...` for traceability |
| `stripe_payment_intent_id` | string | `pi_...` |
| `description` | string | Human-readable summary |
| `metadata_json` | JSON | Arbitrary extra context |
| `created_at` | timestamptz indexed | |

---

## Migration

Migration was auto-generated with Alembic and is applied to the live DB.

```bash
cd src/server

# generate (already done)
just migrate "add_wallet_checkout_transaction_tables"

# apply
just upgrade

# verify
docker exec server-db-1 psql -U postgres -d revellio -c "\dt"
```

A pre-existing migration (`add_pgvector_and_embeddings.py`) was also made idempotent — it previously failed if `reasoning_embedding` already existed on `audit_log`. It now uses `ADD COLUMN IF NOT EXISTS`.

---

## Backend — `src/server/my_fastapi_app/app/routes/payments.py`

### `POST /payments/checkout`

Creates a Stripe Checkout Session and persists a `Checkout` row.

**Request body:**
```json
{
  "username": "cbahlis",
  "amount_usd": 50.0,
  "success_url": "http://localhost:5173/wallet?deposit=success",
  "cancel_url":  "http://localhost:5173/wallet?deposit=cancelled"
}
```

**Response:**
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "session_id": "cs_test_..."
}
```

The frontend redirects the user to `checkout_url`. After payment, Stripe fires a webhook.

---

### `GET /payments/balance/{username}`

Returns the user's `Wallet` row. If no wallet exists yet (first visit), one is created with zero balances.

**Response:**
```json
{
  "username": "cbahlis",
  "usd_available": 200.0,
  "brl_available": 0.0,
  "brl_pending": 0.0,
  "total_deposited_brl": 200.0,
  "total_spent_brl": 0.0
}
```

---

### `GET /payments/history/{username}?limit=50&offset=0`

Paginated `Transaction` rows, newest first.

**Response:**
```json
[
  {
    "id": 2,
    "created_at": "2026-04-01T04:05:00+00:00",
    "transaction_type": "deposit",
    "status": "completed",
    "asset": "USD",
    "direction": "credit",
    "amount": 100.0,
    "balance_before": 50.0,
    "balance_after": 150.0,
    "description": "Stripe deposit $100.00",
    "stripe_payment_intent_id": "pi_..."
  }
]
```

---

### `POST /payments/webhook`

Receives `checkout.session.completed` events from Stripe.

**Idempotency:** looks up the `Checkout` row by `stripe_checkout_session_id`. If `status` is already `"completed"`, the event is acknowledged but no balance change is applied — safe for Stripe retries.

**What it does on a valid event:**
1. Finds or creates the user's `Wallet`
2. Credits `usd_available` by `amount_usd`
3. Increments `total_deposited_brl`
4. Decrements `brl_pending`
5. Writes an immutable `Transaction` row
6. Marks the `Checkout` row `status = "completed"` with `completed_at`

**Signature verification:** enabled when `STRIPE_WEBHOOK_SECRET` is set in `.env`. In local dev it should be left blank — the handler falls back to parsing the raw JSON body without verification.

---

## Frontend — `src/client/src/pages/Wallet.tsx`

Wallet page at `/wallet` (protected route, requires Clerk sign-in).

**Sections:**
- **Balance cards** — `usd_available` (Available Balance) + lifetime stats (`total_deposited_brl`, `total_spent_brl`)
- **Deposit form** — preset amounts ($25 / $50 / $100 / $250 / $500) + custom input → calls `POST /payments/checkout` → redirects to Stripe hosted page
- **Transaction history** — calls `GET /payments/history/{username}`, renders credit/debit rows with balance snapshot

The page handles the redirect-back query params:
- `?deposit=success` → green success banner
- `?deposit=cancelled` → amber cancelled banner

---

## Frontend — `src/client/src/API/PaymentsClient.ts`

Three typed functions:

```ts
getBalance(username)          // GET /payments/balance/{username}
getTransactionHistory(username, limit, offset)  // GET /payments/history/{username}
createCheckoutSession(username, amountUsd)      // POST /payments/checkout
```

---

## Navbar + Routing

- `src/client/src/components/Navbar.tsx` — added `<MenuButton redirect_link="/wallet" Name="Wallet" Icon={<Wallet/>}/>` (the `Wallet` icon was already imported but unused)
- `src/client/src/main.tsx` — added `/wallet` protected route pointing to `<WalletPage/>`

---

## Settings — `src/server/my_fastapi_app/app/settings.py`

Two new optional fields:

```python
STRIPE_SECRET_KEY: Optional[str] = None       # sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET: Optional[str] = None   # whsec_... (leave blank in local dev)
```

---

## Environment Variables — `src/server/.env`

```env
STRIPE_PUBLISHABLE_KEY=pk_test_...   # frontend (not currently read by backend)
STRIPE_SECRET_KEY=sk_test_...        # used by payments.py to call Stripe API
STRIPE_WEBHOOK_SECRET=               # leave blank locally; set in production
```

**Important:** the CLI (`stripe listen`) and the API keys in `.env` must belong to the **same Stripe account**. If they differ, `stripe trigger` events work but real payments never reach the webhook listener. Run `stripe config --list` to see which account the CLI is authenticated to and ensure the keys match.

---

## Local Development Workflow

```bash
# 1. start the DB
cd src/server && just up

# 2. apply migrations
just upgrade

# 3. start the backend
just dev

# 4. start the Stripe webhook listener (separate terminal)
stripe listen --forward-to localhost:8000/payments/webhook

# 5. start the frontend (separate terminal)
cd src/client && npm run dev
```

To test:
1. Sign in, go to `/wallet`
2. Enter an amount and click **Deposit via Stripe**
3. Complete the checkout with test card `4242 4242 4242 4242`, any future expiry, any CVC
4. You are redirected back to `/wallet?deposit=success`
5. The webhook fires, `Wallet.usd_available` is credited, a `Transaction` row is written

To replay a missed webhook event:
```bash
stripe events resend evt_...
```

---

## Stripe CLI Key Expiry

The CLI generates a **restricted test key** that expires on a rolling basis (visible in `stripe config --list` under `test_mode_key_expires_at`). For persistent local development, get a permanent test secret key from the Stripe Dashboard → Developers → API keys and use that in `.env` instead.
