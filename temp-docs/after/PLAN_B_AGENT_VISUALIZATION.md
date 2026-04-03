# Plan B: Agent Visualization (Frontend Intelligence Display)

**Owner:** Teammate
**Branch:** `feat/agent-visualization`
**Goal:** Create widget components + onClick handlers + Fix Audit page
**Estimated Time:** 2.5-3 hours

---

## Prerequisites

✅ Backend provides `market_analysis` object in `/agents/status`
✅ Routes agent returns `route_options` array
✅ Multi-user filtering works (commit `f73f1bc`)
✅ Settlement endpoint works (`/payments/settle`)

---

## What You're Building

**Components to create:**
1. `MarketAnalysisCard.tsx` - Shows market intelligence (confidence, thesis, risk flags, metrics)
2. `RouteComparisonCard.tsx` - Shows FX route comparison with best rate highlighted

**Integration work:**
- Add onClick handlers to "Pay Bill" buttons
- Fix Audit page to show "Stellar Testnet" (not "Base Sepolia")
- (Optional) Fix router.py API calls (background work)

**Note:** User will integrate your components into BillScheduler (not your work).

---

## Implementation Steps

### Step 1: Update TypeScript Types (15 min)

**File:** `src/client/src/pages/BillScheduler.tsx`

**Find the `StatusResponse` type (around line 29) and expand it:**

```typescript
// Before:
type StatusResponse = {
  payment_decisions: PaymentDecision[];
  route_options: RouteOption[];
  brl_balance: number;
  usd_balance: number;
  current_fx_rate: number;
  pending_liabilities: unknown[];
  market_prediction: string;
  selected_route: string | null;
  audit_hash: string | null;
};

// After: Add detailed types
type MarketMetrics = {
  selic_rate: number | null;
  fed_funds_rate: number | null;
  usd_brl_rate: number | null;
  oil_price_usd: number | null;
  soy_price_usd_per_bushel: number | null;
  iron_ore_price_usd_per_ton: number | null;
  fiscal_health_score: number | null;
  geopolitical_risk_score: number | null;
  political_stability_score: number | null;
  fiscal_context: string | null;
  political_context: string | null;
  geopolitical_context: string | null;
  fetched_at: string | null;
};

type MarketAnalysis = {
  prediction: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;  // 0.0 to 1.0
  thesis: string;
  risk_flags: string[];
  metrics: MarketMetrics;
};

type RouteOption = {
  name: string;
  provider: string;
  fx_used: number;
  fee_usd: number;
  eta_hours: number;
  is_instant: boolean;
  description: string;
  brl_received: number;
  reference_usd: number;
};

type StatusResponse = {
  payment_decisions: PaymentDecision[];
  route_options: RouteOption[];
  brl_balance: number;
  usd_balance: number;
  current_fx_rate: number;
  pending_liabilities: unknown[];
  market_prediction: string;  // Keep for backward compat
  market_analysis: MarketAnalysis;  // ← NEW: Full analysis object
  selected_route: string | null;
  audit_hash: string | null;
};
```

**Export types for components:**

```typescript
// At bottom of file or in new types file
export type { MarketAnalysis, RouteOption, MarketMetrics };
```

---

### Step 2: Create Market Analysis Widget (1 hour)

**Create:** `src/client/src/components/MarketAnalysisCard.tsx`

```typescript
import { type FC } from "react";

type MarketMetrics = {
  selic_rate: number | null;
  fed_funds_rate: number | null;
  oil_price_usd: number | null;
  fiscal_health_score: number | null;
  geopolitical_risk_score: number | null;
  political_stability_score: number | null;
  fetched_at: string | null;
};

type MarketAnalysis = {
  prediction: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  thesis: string;
  risk_flags: string[];
  metrics: MarketMetrics;
};

type Props = {
  analysis: MarketAnalysis | undefined;
};

const C = {
  bg: "#0a0a0a",
  rose: "#fb7185",
  cream: "#fef3c7",
  green: "#4ade80",
  yellow: "#fbbf24",
  red: "#f87171",
};

export const MarketAnalysisCard: FC<Props> = ({ analysis }) => {
  if (!analysis) {
    return (
      <div style={{ padding: "1rem", color: "#999" }}>
        Market analysis loading...
      </div>
    );
  }

  const { prediction, confidence, thesis, risk_flags, metrics } = analysis;

  // Confidence color coding
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return C.green;
    if (conf >= 0.6) return C.yellow;
    return C.red;
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "#666";
    if (score >= 7) return C.green;
    if (score >= 4) return C.yellow;
    return C.red;
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        borderRadius: "1rem",
        padding: "1.5rem",
        marginBottom: "1.5rem",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "1rem" }}>
        <h3
          style={{
            fontSize: "1.25rem",
            fontWeight: "bold",
            marginBottom: "0.5rem",
          }}
        >
          Market Analysis
        </h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          {/* Prediction Badge */}
          <div
            style={{
              background:
                prediction === "BULLISH"
                  ? "rgba(74, 222, 128, 0.2)"
                  : prediction === "BEARISH"
                    ? "rgba(248, 113, 113, 0.2)"
                    : "rgba(251, 191, 36, 0.2)",
              color:
                prediction === "BULLISH"
                  ? C.green
                  : prediction === "BEARISH"
                    ? C.red
                    : C.yellow,
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontWeight: "bold",
              fontSize: "0.875rem",
            }}
          >
            {prediction}
          </div>

          {/* Confidence Indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", color: "#999" }}>
              Confidence:
            </span>
            <div
              style={{
                width: "100px",
                height: "8px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${confidence * 100}%`,
                  height: "100%",
                  background: getConfidenceColor(confidence),
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: "bold",
                color: getConfidenceColor(confidence),
              }}
            >
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Thesis */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          padding: "1rem",
          borderRadius: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        <p style={{ fontSize: "0.875rem", lineHeight: "1.6", margin: 0 }}>
          {thesis}
        </p>
      </div>

      {/* Risk Flags */}
      {risk_flags && risk_flags.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4
            style={{
              fontSize: "0.875rem",
              fontWeight: "600",
              color: C.red,
              marginBottom: "0.5rem",
            }}
          >
            ⚠️ Risk Flags:
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {risk_flags.map((flag, idx) => (
              <span
                key={idx}
                style={{
                  background: "rgba(248, 113, 113, 0.15)",
                  color: C.red,
                  padding: "0.25rem 0.75rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.75rem",
                }}
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div>
        <h4
          style={{
            fontSize: "0.875rem",
            fontWeight: "600",
            marginBottom: "0.75rem",
            color: "#ddd",
          }}
        >
          Key Metrics:
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {/* Macro */}
          {metrics.selic_rate !== null && (
            <MetricItem
              label="SELIC Rate"
              value={`${metrics.selic_rate.toFixed(2)}%`}
              color="#999"
            />
          )}
          {metrics.fed_funds_rate !== null && (
            <MetricItem
              label="Fed Rate"
              value={`${metrics.fed_funds_rate.toFixed(2)}%`}
              color="#999"
            />
          )}

          {/* Commodities */}
          {metrics.oil_price_usd !== null && (
            <MetricItem
              label="Oil"
              value={`$${metrics.oil_price_usd.toFixed(0)}/bbl`}
              color="#999"
            />
          )}

          {/* Sentiment */}
          {metrics.fiscal_health_score !== null && (
            <MetricItem
              label="Fiscal Health"
              value={`${metrics.fiscal_health_score}/10`}
              color={getScoreColor(metrics.fiscal_health_score)}
            />
          )}
          {metrics.geopolitical_risk_score !== null && (
            <MetricItem
              label="Geopolitical Risk"
              value={`${metrics.geopolitical_risk_score}/10`}
              color={getScoreColor(10 - metrics.geopolitical_risk_score)}
            />
          )}
          {metrics.political_stability_score !== null && (
            <MetricItem
              label="Political Stability"
              value={`${metrics.political_stability_score}/10`}
              color={getScoreColor(metrics.political_stability_score)}
            />
          )}
        </div>
      </div>

      {/* Fetched At */}
      {metrics.fetched_at && (
        <div
          style={{
            marginTop: "1rem",
            fontSize: "0.75rem",
            color: "#666",
            textAlign: "right",
          }}
        >
          Updated: {new Date(metrics.fetched_at).toLocaleString()}
        </div>
      )}
    </div>
  );
};

// Helper component
const MetricItem: FC<{ label: string; value: string; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div
    style={{
      background: "rgba(255,255,255,0.03)",
      padding: "0.5rem",
      borderRadius: "0.375rem",
    }}
  >
    <div style={{ fontSize: "0.625rem", color: "#999", marginBottom: "0.25rem" }}>
      {label}
    </div>
    <div style={{ fontSize: "0.875rem", fontWeight: "600", color }}>
      {value}
    </div>
  </div>
);
```

**Test component:**
```typescript
// Test in BillScheduler temporarily
import { MarketAnalysisCard } from "../components/MarketAnalysisCard";

// Add somewhere in JSX:
<MarketAnalysisCard analysis={status?.market_analysis} />
```

---

### Step 3: Create Route Comparison Widget (1 hour)

**Create:** `src/client/src/components/RouteComparisonCard.tsx`

```typescript
import { type FC } from "react";

type RouteOption = {
  name: string;
  provider: string;
  fx_used: number;
  fee_usd: number;
  eta_hours: number;
  is_instant: boolean;
  description: string;
  brl_received: number;
  reference_usd: number;
};

type Props = {
  routes: RouteOption[];
  selectedRoute?: string | null;
};

const C = {
  bg: "#0a0a0a",
  rose: "#fb7185",
  cream: "#fef3c7",
  green: "#4ade80",
  yellow: "#fbbf24",
};

export const RouteComparisonCard: FC<Props> = ({ routes, selectedRoute }) => {
  if (!routes || routes.length === 0) {
    return (
      <div style={{ padding: "1rem", color: "#999" }}>
        No routes available
      </div>
    );
  }

  // Find best route (LOWEST BRL per USD = user pays less)
  const bestRoute = routes.reduce((best, current) =>
    current.fx_used < best.fx_used ? current : best
  );

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        borderRadius: "1rem",
        padding: "1.5rem",
        marginBottom: "1.5rem",
      }}
    >
      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: "bold",
          marginBottom: "1rem",
        }}
      >
        Payment Routes
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {routes.map((route) => {
          const isBest = route.name === bestRoute.name;
          const isSelected = selectedRoute === route.name;

          // Calculate cost for $1000 reference
          const costFor1000 = 1000 * route.fx_used + (route.fee_usd || 0);
          const bestCost = 1000 * bestRoute.fx_used + (bestRoute.fee_usd || 0);
          const extraCost = costFor1000 - bestCost;

          return (
            <div
              key={route.name}
              style={{
                background: isBest
                  ? "rgba(74, 222, 128, 0.1)"
                  : "rgba(255,255,255,0.03)",
                border: isBest ? `2px solid ${C.green}` : "2px solid transparent",
                borderRadius: "0.75rem",
                padding: "1rem",
                position: "relative",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <h4 style={{ fontSize: "1rem", fontWeight: "600", margin: 0 }}>
                    {route.name}
                  </h4>
                  {isBest && (
                    <span
                      style={{
                        background: C.green,
                        color: C.bg,
                        padding: "0.125rem 0.5rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.625rem",
                        fontWeight: "bold",
                      }}
                    >
                      BEST RATE
                    </span>
                  )}
                  {route.is_instant && (
                    <span
                      style={{
                        background: "rgba(251, 113, 133, 0.2)",
                        color: C.rose,
                        padding: "0.125rem 0.5rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.625rem",
                        fontWeight: "bold",
                      }}
                    >
                      INSTANT
                    </span>
                  )}
                </div>

                {/* Rate Display */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.125rem", fontWeight: "bold" }}>
                    {route.fx_used.toFixed(2)} BRL/USD
                  </div>
                  {!isBest && extraCost > 0 && (
                    <div style={{ fontSize: "0.75rem", color: C.yellow }}>
                      +R${extraCost.toFixed(2)} more
                    </div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                  gap: "0.5rem",
                  fontSize: "0.75rem",
                  color: "#999",
                }}
              >
                <div>
                  <span style={{ color: "#666" }}>Fee:</span> $
                  {route.fee_usd.toFixed(2)}
                </div>
                <div>
                  <span style={{ color: "#666" }}>ETA:</span>{" "}
                  {route.eta_hours < 1
                    ? "Instant"
                    : `${route.eta_hours}h`}
                </div>
                <div>
                  <span style={{ color: "#666" }}>For $1000:</span> R$
                  {costFor1000.toFixed(2)}
                </div>
              </div>

              {/* Description */}
              {route.description && (
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#999",
                    marginTop: "0.5rem",
                    marginBottom: 0,
                  }}
                >
                  {route.description}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Note */}
      <div
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "rgba(251, 191, 36, 0.1)",
          borderRadius: "0.5rem",
          fontSize: "0.75rem",
          color: C.yellow,
        }}
      >
        ℹ️ Revellio automatically uses the best available rate for your payments.
        Rates shown for ${routes[0]?.reference_usd || 1000} USD reference.
      </div>
    </div>
  );
};
```

**Test component:**
```typescript
// Test in BillScheduler temporarily
import { RouteComparisonCard } from "../components/RouteComparisonCard";

// Add somewhere in JSX:
<RouteComparisonCard
  routes={status?.route_options || []}
  selectedRoute={status?.selected_route}
/>
```

---

### Step 4: Add onClick Handlers to Pay Bill Buttons (30 min)

**File:** `src/client/src/pages/BillScheduler.tsx`

#### 4.1 Add State for Payment Processing

```typescript
// After existing state declarations (around line 108)
const [processingPayment, setProcessingPayment] = useState<number | null>(null);
const [paymentError, setPaymentError] = useState<string | null>(null);
```

#### 4.2 Add Payment Handler Function

```typescript
// After fetchStatus function (around line 200)
async function handlePayBill(bill: ScheduledBill) {
  setProcessingPayment(bill.id);
  setPaymentError(null);

  try {
    // TODO: Get username from auth context (hardcoded for now)
    const username = "testuser";

    const response = await fetch('http://localhost:8000/payments/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
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
      `Rate: ${result.fx_rate} BRL/USD (from ${result.fx_provider})\n\n` +
      `Stellar TX: ${result.stellar_mint_tx.slice(0, 10)}...\n\n` +
      `Check your email for receipt!`
    );

    // Refresh status to update UI
    fetchStatus();
  } catch (error) {
    console.error('Payment error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    setPaymentError(errorMsg);
    alert(`❌ Payment failed: ${errorMsg}`);
  } finally {
    setProcessingPayment(null);
  }
}
```

#### 4.3 Update Desktop "Pay Bill" Button

**Find desktop button (around line 539):**

```typescript
// Before:
<button
  className="rounded-xl px-4 py-2 text-xs font-bold transition hover:opacity-90"
  style={{ background: C.rose, color: C.bg }}
>
  {bill.recommendation === "Pay Now"
    ? "Pay Bill"
    : bill.recommendation === "Wait"
      ? "Schedule"
      : "Track Rate"}
</button>

// After:
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

#### 4.4 Update Mobile "Pay Bill" Button

**Find mobile button (around line 632):**

```typescript
// Same changes as desktop button
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

---

### Step 5: Fix Audit Page Blockchain Display (30 min)

**File:** `src/client/src/pages/Audit.tsx`

#### 5.1 Replace Mock Data Network

**Find MOCK_DECISIONS (around line 49-100):**

```typescript
// Before:
const MOCK_DECISIONS: TrustDecision[] = [
  {
    id: "dec_1042",
    network: "Base Sepolia",  // ← Wrong!
    tx_hash: "0xabc123...",
    // ...
  }
]

// After:
const MOCK_DECISIONS: TrustDecision[] = [
  {
    id: "dec_1042",
    network: "Stellar Testnet",  // ✅ Correct!
    tx_hash: "7309ca89e83f480ac04cf34269e07b5706e5083c9ca90c635d9875d1e7c428cd",
    timestamp: "2026-03-28T14:23:00Z",
    decision_type: "Payment Authorization",
    confidence: 87,
    status: "completed",
    verification_link: "https://stellar.expert/explorer/testnet/tx/7309ca89e83f480ac04cf34269e07b5706e5083c9ca90c635d9875d1e7c428cd",
    details: {
      amount_usd: 1250,
      amount_brl: 6500,
      fx_rate: 5.2,
      liability_name: "USF Spring 2026 Tuition"
    }
  },
  // ... update other mock entries similarly
]
```

#### 5.2 Update All Mock Entries

**Replace all instances of:**
- `"Base Sepolia"` → `"Stellar Testnet"`
- `"0xabc..."` hashes → Real Stellar TX hashes (64 hex chars)
- Ethereum explorer links → Stellar explorer links

#### 5.3 Add Comment for Future Backend Integration

```typescript
// At top of mock data
// TODO: Replace with real backend data
// Endpoint: GET /blockchain/audit_log?username={username}
// For now, using mock data with correct Stellar Testnet format
const MOCK_DECISIONS: TrustDecision[] = [
  // ...
];
```

---

### Step 6: (Optional Background) Fix Router.py API Calls

**File:** `src/server/agents/router.py`

**Context:** You mentioned fixing API calls to Crebit/Wise/Remitly. Router.py already has fallbacks, so this is non-blocking.

**If APIs are failing, check:**

1. **API keys in .env:**
   ```bash
   WISE_API_KEY=your_key_here
   # Crebit and Remitly use public endpoints (no key needed)
   ```

2. **Network issues:**
   ```python
   # Router.py already has try/except for each provider
   try:
       crebit_response = client.post(...)
   except Exception as e:
       print(f"⚠️ Router: Crebit quote failed: {e}")
       # Continues with other providers
   ```

3. **Fallback values work:**
   ```python
   # If all APIs fail, router returns empty list
   # FX service then uses fallback rate (5.5)
   # So settlement always works!
   ```

**No action needed unless you want better API reliability.**

---

## Testing Plan

### Test 1: Widget Components Render

```bash
# 1. Start frontend
cd src/client
npm run dev

# 2. Navigate to Bill Scheduler
open http://localhost:5173/bill-scheduler

# 3. Verify (if you add components to test):
#    - Market Analysis card shows prediction, confidence, thesis
#    - Route Comparison card shows Crebit/Wise/Remitly with best rate badge
```

### Test 2: Pay Bill Button Works

```bash
# 1. Ensure backend running and user has BRL balance
# 2. Click "Pay Bill" on a "Pay Now" recommendation
# 3. Verify:
#    - Button changes to "Processing..."
#    - Alert shows success with provider name
#    - Bill disappears from list (marked paid)
#    - Email received (if SMTP configured)
```

### Test 3: Audit Page Shows Stellar

```bash
# 1. Navigate to Audit page
open http://localhost:5173/audit

# 2. Verify:
#    - Network badge shows "Stellar Testnet" (not "Base Sepolia")
#    - Explorer links go to stellar.expert (not Sepolia block explorer)
```

---

## Success Criteria

- ✅ TypeScript types updated with full market_analysis structure
- ✅ MarketAnalysisCard component created and working
- ✅ RouteComparisonCard component created and working
- ✅ "Pay Bill" buttons trigger settlement
- ✅ Success feedback shows provider used
- ✅ Button shows loading state ("Processing...")
- ✅ Audit page displays "Stellar Testnet"
- ✅ Components are ready for user to integrate into BillScheduler

---

## Files Created/Modified

**Created:**
1. `src/client/src/components/MarketAnalysisCard.tsx` - Market intelligence widget
2. `src/client/src/components/RouteComparisonCard.tsx` - Route comparison widget

**Modified:**
3. `src/client/src/pages/BillScheduler.tsx` - Types + onClick handlers
4. `src/client/src/pages/Audit.tsx` - Fix blockchain network display

**Optional (Background):**
5. `src/server/agents/router.py` - Fix API calls (if needed)

---

## Handoff to User

Once you complete steps 1-5, notify user that:

1. ✅ Both widget components are ready
2. ✅ onClick handlers work (can test with "Pay Bill" button)
3. ✅ TypeScript types updated
4. ✅ Audit page fixed

User will then:
- Integrate MarketAnalysisCard and RouteComparisonCard into BillScheduler (their Plan A, Step 2)
- Test end-to-end flow

---

## Notes

**Router.py resilience:**
- Has fallbacks for each API (Crebit/Wise/Remitly)
- If all fail, FX service uses 5.5 fallback rate
- Settlement never blocks on API failures

**Component design:**
- Self-contained (no external dependencies)
- Handles loading/error states
- Uses inline styles (matches existing design system)
- Responsive (works on mobile + desktop)

---

**Ready to implement!** Follow steps 1-5, components are independent so can be done in parallel.
