# Plan B: Agent Visualization (Frontend Intelligence Display)

**Owner:** Teammate
**Branch:** `feat/agent-visualization`
**Goal:** Visualize all agent intelligence currently hidden from users
**Estimated Time:** 4-6 hours

---

## Prerequisites

✅ Backend provides `market_analysis` object in `/agents/status`
✅ Routes agent returns `route_options` array
✅ Audit log stores blockchain hashes
✅ Multi-user filtering works (commit `f73f1bc`)

---

## What's Currently Missing

**Backend provides (via `/agents/status`):**
```typescript
{
  market_analysis: {
    prediction: "BULLISH",
    confidence: 0.87,              // ← NOT SHOWN
    thesis: "Strong fundamentals", // ← NOT SHOWN
    risk_flags: [...],             // ← NOT SHOWN
    metrics: {
      selic_rate: 10.75,           // ← NOT SHOWN
      fed_funds_rate: 5.5,         // ← NOT SHOWN
      oil_price_usd: 82.5,         // ← NOT SHOWN
      fiscal_health_score: 7,      // ← NOT SHOWN
      // ... 20+ more metrics
    }
  },
  route_options: [...],            // ✅ Partially shown
  payment_decisions: [...]         // ✅ Shown
}
```

**Frontend currently shows:**
- Simple string: "BULLISH" or "BEARISH"
- Route options (list only)
- Payment decisions (recommendations)

**Frontend SHOULD show:**
- Confidence levels with visual indicators
- Market thesis explanation
- Risk warnings
- Sentiment analysis (fiscal health, geopolitical risk)
- Macro/commodity metrics
- Route comparison with savings calculations
- Real audit log (not mock data)

---

## Implementation Steps

### Step 1: Update TypeScript Types (15 min)

**File:** `src/client/src/pages/BillScheduler.tsx`

**Find the `StatusResponse` type (line 29) and expand it:**

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

// After:
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

  // Find best route (highest BRL received)
  const bestRoute = routes.reduce((best, current) =>
    current.brl_received > best.brl_received ? current : best
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
          const savings = route.brl_received - bestRoute.brl_received;

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

                {/* BRL Received */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.125rem", fontWeight: "bold" }}>
                    R${route.brl_received.toFixed(2)}
                  </div>
                  {!isBest && savings < 0 && (
                    <div style={{ fontSize: "0.75rem", color: C.yellow }}>
                      -{Math.abs(savings).toFixed(2)} BRL
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
                  <span style={{ color: "#666" }}>Rate:</span>{" "}
                  {route.fx_used.toFixed(2)} BRL/USD
                </div>
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
        ℹ️ Revellio automatically uses the best available route for your payments.
        Rates shown for ${routes[0]?.reference_usd || 1000} USD reference.
      </div>
    </div>
  );
};
```

---

### Step 4: Integrate into BillScheduler (30 min)

**File:** `src/client/src/pages/BillScheduler.tsx`

**Import new components (top of file):**
```typescript
import { MarketAnalysisCard } from "../components/MarketAnalysisCard";
import { RouteComparisonCard } from "../components/RouteComparisonCard";
```

**Add before bill list (around line 300):**
```typescript
{/* Market Analysis */}
{status && (
  <MarketAnalysisCard analysis={status.market_analysis} />
)}

{/* Route Comparison */}
{status && status.route_options && status.route_options.length > 0 && (
  <RouteComparisonCard
    routes={status.route_options}
    selectedRoute={status.selected_route}
  />
)}

{/* Existing bill list below... */}
```

---

### Step 5: Fix Audit Page Blockchain Display (30 min)

**File:** `src/client/src/pages/Audit.tsx`

**Replace mock data with real backend call:**

**Find MOCK_DECISIONS (lines 49-100):**
```typescript
// Before: Using mock data
const MOCK_DECISIONS: TrustDecision[] = [
  {
    network: "Base Sepolia",  // ← Wrong!
    // ...
  }
]
```

**Replace with:**
```typescript
// After: Fetch from backend
const [decisions, setDecisions] = useState<TrustDecision[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchAuditLog() {
    try {
      // TODO: Backend needs to create this endpoint
      // For now, use mock data but with correct blockchain
      const mockDecisions: TrustDecision[] = [
        {
          id: "dec_1042",
          network: "Stellar Testnet",  // ✅ Correct!
          tx_hash: "7309ca89e83f480ac04cf34269e07b5706e5083c9ca90c635d9875d1e7c428cd",
          timestamp: "2026-03-28T14:23:00Z",
          decision_type: "Payment Authorization",
          confidence: 87,
          status: "completed",
          verification_link: `https://stellar.expert/explorer/testnet/tx/7309ca89e83f480ac04cf34269e07b5706e5083c9ca90c635d9875d1e7c428cd`,
          details: {
            amount_usd: 1250,
            amount_brl: 6500,
            fx_rate: 5.2,
            liability_name: "USF Spring 2026 Tuition"
          }
        }
      ];

      setDecisions(mockDecisions);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch audit log:", error);
      setLoading(false);
    }
  }

  fetchAuditLog();
}, []);
```

**Update blockchain badge (around line 250):**
```typescript
// Before:
<span className="blockchain-badge">Base Sepolia</span>

// After:
<span className="blockchain-badge">
  {decision.network}  {/* Shows "Stellar Testnet" */}
</span>
```

---

### Step 6: Add onClick Handlers to Pay Bill Buttons (1 hour)

**File:** `src/client/src/pages/BillScheduler.tsx`

**Add state for payment processing:**
```typescript
const [processingPayment, setProcessingPayment] = useState<number | null>(null);
const [paymentError, setPaymentError] = useState<string | null>(null);
```

**Add payment handler:**
```typescript
async function handlePayBill(bill: ScheduledBill) {
  setProcessingPayment(bill.id);
  setPaymentError(null);

  try {
    // Get current user from context/auth
    const username = "testuser"; // TODO: Get from auth context

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

    // Show success (you can replace with a toast/modal)
    alert(
      `✅ Payment successful!\n\n` +
      `Paid: ${bill.name}\n` +
      `Amount: $${result.amount_usd} (R$${result.amount_brl_spent})\n` +
      `Rate: ${result.fx_rate} BRL/USD (${result.fx_provider})\n\n` +
      `Stellar TX: ${result.stellar_mint_tx.slice(0, 10)}...\n\n` +
      `Check your email for receipt!`
    );

    // Refresh status
    fetchStatus();
  } catch (error) {
    console.error('Payment error:', error);
    setPaymentError(error instanceof Error ? error.message : 'Unknown error');
    alert(`❌ Payment failed: ${paymentError}`);
  } finally {
    setProcessingPayment(null);
  }
}
```

**Update button onClick (Desktop - around line 539):**
```typescript
<button
  onClick={() => {
    if (bill.recommendation === "Pay Now") {
      handlePayBill(bill);
    } else {
      alert('Schedule/Track functionality coming soon!');
    }
  }}
  disabled={processingPayment === bill.id}
  className="..."
  style={{ ... }}
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

**Update mobile button similarly (around line 632).**

---

## Testing Plan

### Test 1: Market Analysis Displays

```bash
# 1. Start backend
# 2. Navigate to Bill Scheduler
# 3. Verify market analysis card shows:
#    - Prediction badge (BULLISH/BEARISH)
#    - Confidence bar (e.g., 87%)
#    - Thesis text
#    - Risk flags (if any)
#    - Key metrics (SELIC, Fed rate, etc.)
```

### Test 2: Route Comparison Shows Best Rate

```bash
# 1. Check that route comparison card displays
# 2. Verify "BEST RATE" badge on optimal route
# 3. Check savings calculation on other routes
# 4. Verify instant badge on instant routes
```

### Test 3: Pay Bill Button Works

```bash
# 1. Click "Pay Bill" on a "Pay Now" recommendation
# 2. Button should show "Processing..."
# 3. Alert shows success with rate and provider
# 4. Bill disappears from list (marked paid)
# 5. Email received with blockchain proof
```

### Test 4: Audit Page Shows Stellar

```bash
# 1. Navigate to Audit page
# 2. Verify network shows "Stellar Testnet" (not "Base Sepolia")
# 3. Verify Stellar Explorer links work
```

---

## Success Criteria

- ✅ Market analysis card shows all intelligence
- ✅ Confidence levels visualized
- ✅ Risk flags displayed
- ✅ Route comparison shows best rate
- ✅ Savings calculated for each route
- ✅ Pay Bill buttons trigger settlement
- ✅ Success feedback shows provider used
- ✅ Audit page uses correct blockchain
- ✅ All TypeScript types updated

---

## Files Modified

1. **EDIT:** `src/client/src/pages/BillScheduler.tsx` (types, onClick handlers, integrate widgets)
2. **NEW:** `src/client/src/components/MarketAnalysisCard.tsx`
3. **NEW:** `src/client/src/components/RouteComparisonCard.tsx`
4. **EDIT:** `src/client/src/pages/Audit.tsx` (fix blockchain network)

---

## Optional Enhancements

**If time permits:**

1. **Toast notifications** instead of alerts
2. **Animated confidence bar** on load
3. **Expandable metrics** (click to see all 20+ metrics)
4. **Historical trend charts** (confidence over time)
5. **Real-time rate updates** (polling every 5 min)

---

**Ready to implement?** Create branch `feat/agent-visualization` and follow steps 1-6!
