import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  TrendingDown,
  CircleDollarSign,
  TrendingUp,
  Clock,
} from "lucide-react";
import Navbar from "../components/Navbar";
import { useUser } from "@clerk/react-router";

const C = {
  bg: "#2C3930",
  surface: "rgba(63,79,68,0.18)",
  border: "rgba(162,123,92,0.1)",
  rose: "#A27B5C",
  cream: "#DCD7C9",
  muted: "rgba(220,215,201,0.5)",
};

type BillRecommendation = "Pay Now" | "Wait" | "Track";
type FilterType =
  | "all"
  | "pay-now"
  | "wait"
  | "track"
  | "predicted"
  | "confirmed";

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

type PaymentDecision = {
  liability_id: number;
  name: string;
  amount_usd: number;
  is_predicted: boolean;
  pay: boolean;
  reason: string;
  cost_estimate_brl: number;
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

type ScheduledBill = {
  id: number;
  name: string;
  amountUsd: number;
  amountBrl: number;
  dueIn: string;
  recommendation: BillRecommendation;
  note: string;
  category: string;
  isPredicted: boolean;
};

function getRecommendationFromDecision(
  decision: PaymentDecision
): BillRecommendation {
  if (decision.pay) return "Pay Now";

  const reason = decision.reason.toLowerCase();
  if (reason.includes("track") || reason.includes("monitor")) return "Track";
  return "Wait";
}

function getCategoryFromName(name: string): string {
  const lower = name.toLowerCase();

  if (lower.includes("tuition") || lower.includes("usf")) return "Education";
  if (
    lower.includes("rent") ||
    lower.includes("landlord") ||
    lower.includes("property")
  ) {
    return "Housing";
  }
  if (lower.includes("grocery") || lower.includes("living")) return "Living";
  if (lower.includes("utility")) return "Utilities";
  if (lower.includes("insurance")) return "Insurance";

  return "General";
}

export default function BillScheduler() {
  const { user } = useUser();
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function formatCurrency(value: number, currency: "USD" | "BRL") {
    return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
      style: "currency",
      currency,
    }).format(value);
  }

  function getTabClass(filter: FilterType) {
    const isActive = selectedFilter === filter;
    return isActive
      ? "border-b-2 px-4 py-3 text-sm font-bold sm:px-6"
      : "border-b-2 border-transparent px-4 py-3 text-sm font-bold transition-colors sm:px-6";
  }

  function getTabStyle(filter: FilterType): React.CSSProperties {
    const isActive = selectedFilter === filter;
    return isActive
      ? { borderColor: C.rose, color: C.rose }
      : { color: C.muted };
  }

  function getRecommendationBadgeStyle(
    recommendation: BillRecommendation
  ): React.CSSProperties {
    switch (recommendation) {
      case "Pay Now":
        return {
          background: "rgba(52,211,153,0.15)",
          color: "#34d399",
        };
      case "Wait":
        return {
          background: "rgba(245,158,11,0.15)",
          color: "#f59e0b",
        };
      case "Track":
        return {
          background: "rgba(162,123,92,0.15)",
          color: C.rose,
        };
      default:
        return {
          background: "rgba(220,215,201,0.08)",
          color: C.cream,
        };
    }
  }

  function getPredictionBadgeStyle(isPredicted: boolean): React.CSSProperties {
    return isPredicted
      ? {
          background: "rgba(168,85,247,0.15)",
          color: "#c084fc",
        }
      : {
          background: "rgba(220,215,201,0.08)",
          color: C.cream,
        };
  }

  useEffect(() => {
    async function loadStatus() {
      try {
        setLoading(true);
        setError(null);

        const url = new URL("http://localhost:8000/agents/status");
        if (user?.username) url.searchParams.set("username", user.username);
        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`Failed to fetch /status: ${response.status}`);
        }

        const data: StatusResponse = await response.json();
        setStatus(data);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadStatus();
  }, [user?.username]);

  const bills: ScheduledBill[] = useMemo(() => {
    if (!status?.payment_decisions) return [];

    return status.payment_decisions.map((decision) => ({
      id: decision.liability_id,
      name: decision.name,
      amountUsd: decision.amount_usd,
      amountBrl: decision.cost_estimate_brl,
      dueIn: decision.is_predicted ? "Predicted payment" : "Confirmed payment",
      recommendation: getRecommendationFromDecision(decision),
      note: decision.reason,
      category: getCategoryFromName(decision.name),
      isPredicted: decision.is_predicted,
    }));
  }, [status]);

  const filteredBills = bills.filter((bill) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "pay-now") return bill.recommendation === "Pay Now";
    if (selectedFilter === "wait") return bill.recommendation === "Wait";
    if (selectedFilter === "track") return bill.recommendation === "Track";
    if (selectedFilter === "predicted") return bill.isPredicted;
    if (selectedFilter === "confirmed") return !bill.isPredicted;
    return true;
  });

  const bestRoute = status?.route_options?.[0];

  return (
    <div
      className="font-sans antialiased"
      style={{ background: C.bg, color: C.cream }}
    >
      <div className="flex min-h-screen overflow-hidden">
        <Navbar />

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <header
            className="flex flex-col justify-between gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:px-8"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <div>
              <h2
                className="text-2xl font-extrabold tracking-tight sm:text-3xl"
                style={{ color: C.cream }}
              >
                Bill Scheduler
              </h2>
              <p
                className="mt-1 text-sm sm:text-base"
                style={{ color: C.muted }}
              >
                Optimize when to pay your international bills based on FX timing
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-6 md:grid-cols-3 lg:px-8">
            {/* Current USD/BRL */}
            <div
              className="rounded-2xl p-5"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <div className="mb-4 flex items-start justify-between">
                <div
                  className="rounded-lg p-2"
                  style={{ background: `${C.rose}18`, color: C.rose }}
                >
                  <TrendingDown className="h-5 w-5" />
                </div>
                <span
                  className="text-[10px] font-bold tracking-wide sm:text-xs"
                  style={{ color: C.muted }}
                >
                  CURRENT USD/BRL
                </span>
              </div>
              <p
                className="text-xl font-black sm:text-2xl"
                style={{ color: C.cream }}
              >
                {bestRoute ? formatCurrency(bestRoute.fx_used, "BRL") : "—"}
              </p>
              <p
                className="mt-1 flex items-center gap-1 text-xs"
                style={{ color: "#34d399" }}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {status?.market_prediction
                  ? `${status.market_prediction} market signal`
                  : "No market data"}
              </p>
            </div>

            {/* Market Signal */}
            <div
              className="rounded-2xl p-5"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <div className="mb-4 flex items-start justify-between">
                <div
                  className="rounded-lg p-2"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                >
                  <CircleDollarSign className="h-5 w-5" />
                </div>
                <span
                  className="text-[10px] font-bold tracking-wide sm:text-xs"
                  style={{ color: C.muted }}
                >
                  MARKET SIGNAL
                </span>
              </div>
              <p
                className="text-xl font-black sm:text-2xl"
                style={{ color: C.cream }}
              >
                {status?.market_prediction ?? "—"}
              </p>
              <p
                className="mt-1 whitespace-pre-line text-xs"
                style={{ color: C.muted }}
              >
                {status?.selected_route ?? "No recommendation available"}
              </p>
            </div>

            {/* Best route */}
            <div
              className="rounded-2xl p-5"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <div className="mb-4 flex items-start justify-between">
                <div
                  className="rounded-lg p-2"
                  style={{ background: `${C.rose}18`, color: C.rose }}
                >
                  <Clock className="h-5 w-5" />
                </div>
                <span
                  className="text-[10px] font-bold tracking-wide sm:text-xs"
                  style={{ color: C.muted }}
                >
                  BEST ROUTE
                </span>
              </div>
              <p
                className="text-xl font-black sm:text-2xl"
                style={{ color: C.cream }}
              >
                {bestRoute?.provider ?? "—"}
              </p>
              <p className="mt-1 text-xs" style={{ color: C.muted }}>
                {bestRoute?.description ?? "No route details available"}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-2 px-4 sm:px-6 lg:px-8">
            <div className="overflow-x-auto">
              <div
                className="flex min-w-max"
                style={{ borderBottom: `1px solid ${C.border}` }}
              >
                {(
                  [
                    "all",
                    "pay-now",
                    "wait",
                    "track",
                    "predicted",
                    "confirmed",
                  ] as FilterType[]
                ).map((filter) => (
                  <button
                    key={filter}
                    className={getTabClass(filter)}
                    style={getTabStyle(filter)}
                    onClick={() => setSelectedFilter(filter)}
                  >
                    {filter === "all"
                      ? "All Bills"
                      : filter === "pay-now"
                        ? "Pay Now"
                        : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table / Cards */}
          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div
              className="rounded-2xl"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              {loading ? (
                <div className="px-6 py-10 text-center" style={{ color: C.muted }}>
                  Loading bill recommendations...
                </div>
              ) : error ? (
                <div className="px-6 py-10 text-center" style={{ color: "#f87171" }}>
                  {error}
                </div>
              ) : filteredBills.length === 0 ? (
                <div className="px-6 py-10 text-center" style={{ color: C.muted }}>
                  No bill recommendations found.
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[950px] text-left">
                      <thead>
                        <tr
                          style={{
                            borderBottom: `1px solid ${C.border}`,
                            background: "rgba(63,79,68,0.25)",
                          }}
                        >
                          <th
                            className="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                            style={{ color: C.muted }}
                          >
                            Bill
                          </th>
                          <th
                            className="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                            style={{ color: C.muted }}
                          >
                            Type
                          </th>
                          <th
                            className="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                            style={{ color: C.muted }}
                          >
                            Amount (USD)
                          </th>
                          <th
                            className="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                            style={{ color: C.rose }}
                          >
                            Est. BRL
                          </th>
                          <th
                            className="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                            style={{ color: C.muted }}
                          >
                            Recommendation
                          </th>
                          <th
                            className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider"
                            style={{ color: C.muted }}
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody style={{ borderTop: `1px solid ${C.border}` }}>
                        {filteredBills.map((bill) => (
                          <tr
                            key={bill.id}
                            className="transition-colors"
                            style={{ borderBottom: `1px solid ${C.border}` }}
                          >
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div
                                  className="rounded-xl p-2"
                                  style={{
                                    background: "rgba(162,123,92,0.12)",
                                    color: C.rose,
                                  }}
                                >
                                  <Banknote className="h-5 w-5" />
                                </div>
                                <div>
                                  <p
                                    className="text-sm font-bold"
                                    style={{ color: C.cream }}
                                  >
                                    {bill.name}
                                  </p>

                                  <div className="mt-1 flex items-center gap-2">
                                    <p className="text-xs" style={{ color: C.muted }}>
                                      {bill.category}
                                    </p>
                                    <span
                                      className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest"
                                      style={getPredictionBadgeStyle(
                                        bill.isPredicted
                                      )}
                                    >
                                      {bill.isPredicted
                                        ? "Predicted"
                                        : "Confirmed"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td
                              className="px-6 py-5 text-sm"
                              style={{ color: C.muted }}
                            >
                              {bill.dueIn}
                            </td>

                            <td
                              className="px-6 py-5 text-sm font-semibold"
                              style={{ color: C.cream }}
                            >
                              {formatCurrency(bill.amountUsd, "USD")}
                            </td>

                            <td
                              className="px-6 py-5 text-sm font-semibold"
                              style={{ color: C.rose }}
                            >
                              {formatCurrency(bill.amountBrl, "BRL")}
                            </td>

                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1">
                                <span
                                  className="w-fit rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest"
                                  style={getRecommendationBadgeStyle(
                                    bill.recommendation
                                  )}
                                >
                                  {bill.recommendation}
                                </span>
                                <p
                                  className="max-w-xs text-xs leading-tight"
                                  style={{ color: C.muted }}
                                >
                                  {bill.note}
                                </p>
                              </div>
                            </td>

                            <td className="px-6 py-5 text-right">
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-4 p-4 md:hidden">
                    {filteredBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="rounded-2xl p-4"
                        style={{
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className="text-sm font-bold"
                              style={{ color: C.cream }}
                            >
                              {bill.name}
                            </p>

                            <div className="mt-1 flex items-center gap-2">
                              <p className="text-xs" style={{ color: C.muted }}>
                                {bill.category}
                              </p>
                              <span
                                className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest"
                                style={getPredictionBadgeStyle(
                                  bill.isPredicted
                                )}
                              >
                                {bill.isPredicted ? "Predicted" : "Confirmed"}
                              </span>
                            </div>
                          </div>

                          <span
                            className="rounded px-2 py-1 text-[10px] font-black uppercase tracking-widest"
                            style={getRecommendationBadgeStyle(
                              bill.recommendation
                            )}
                          >
                            {bill.recommendation}
                          </span>
                        </div>

                        <div
                          className="mt-4 space-y-2 text-sm"
                          style={{ color: C.cream }}
                        >
                          <div className="flex justify-between">
                            <span style={{ color: C.muted }}>Type</span>
                            <span className="font-medium">{bill.dueIn}</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: C.muted }}>USD</span>
                            <span className="font-medium">
                              {formatCurrency(bill.amountUsd, "USD")}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: C.muted }}>BRL</span>
                            <span
                              className="font-semibold"
                              style={{ color: C.rose }}
                            >
                              {formatCurrency(bill.amountBrl, "BRL")}
                            </span>
                          </div>
                        </div>

                        <p
                          className="mt-3 text-xs leading-relaxed"
                          style={{ color: C.muted }}
                        >
                          {bill.note}
                        </p>

                        <button
                          className="mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
                          style={{ background: C.rose, color: C.bg }}
                        >
                          {bill.recommendation === "Pay Now"
                            ? "Pay Bill"
                            : bill.recommendation === "Wait"
                              ? "Schedule"
                              : "Track Rate"}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}