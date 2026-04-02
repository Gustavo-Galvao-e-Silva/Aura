import { useEffect, useState } from "react";
import { useUser } from "@clerk/react-router";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Bell, Clock, House, School, ScrollText,
  ShoppingCart, TrendingDown, TrendingUp,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import Navbar from "../components/Navbar";
import apiClient from "../API/client";
import createUser from "../API/UserClient";

// ─── palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      "#2C3930",
  surface: "rgba(63,79,68,0.18)",
  border:  "rgba(162,123,92,0.1)",
  rose:    "#A27B5C",
  cream:   "#DCD7C9",
  muted:   "rgba(220,215,201,0.5)",
};

// ─── types ────────────────────────────────────────────────────────────────────
type Liability = {
  id: number; username: string; name: string; amount: number;
  currency: string; due_date: string; is_predicted: boolean;
  is_paid: boolean; category: string | null; priority_level: number;
  created_at: string;
};
type DashboardExpensesResponse = { count: number; next_liability: Liability | null };
type FrankfurterTimeSeries = { base: string; start_date: string; end_date: string; rates: Record<string, { BRL: number }> };
type FrankfurterLatest    = { base: string; date: string; rates: { BRL: number } };

// ─── custom tooltip for Recharts ─────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs font-semibold shadow-xl"
      style={{ background: "#253229", border: `1px solid ${C.border}`, color: C.cream }}
    >
      <p style={{ color: C.muted }}>{label}</p>
      <p style={{ color: C.rose }}>{payload[0].value?.toFixed(4)} BRL</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const navigate = useNavigate();

  const [upcomingExpenses, setUpcomingExpenses] = useState<Liability[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

  const [dashboardSummary, setDashboardSummary] = useState<DashboardExpensesResponse | null>(null);
  const [dashboardSummaryLoading, setDashboardSummaryLoading] = useState(true);

  const [fxSeries, setFxSeries] = useState<{ date: string; value: number }[]>([]);
  const [latestRate, setLatestRate] = useState<number | null>(null);
  const [fxLoading, setFxLoading] = useState(true);

  const [targetQuote, setTargetQuote] = useState("");
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);

  useEffect(() => {
    if (isLoaded && (!isSignedIn || !user)) navigate("/");
  }, [isLoaded, isSignedIn, user, navigate]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.username) return;
    createUser({
      fullName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
      email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? "",
      username: user.username,
    }).catch(() => {});
  }, [isLoaded, isSignedIn, user?.username]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.username) return;
    (async () => {
      try {
        setDashboardSummaryLoading(true);
        const res = await apiClient.get("/expenses/dashboard", { params: { username: user!.username } });
        setDashboardSummary(res.data);
      } catch { /* silent */ } finally { setDashboardSummaryLoading(false); }
    })();
  }, [isLoaded, isSignedIn, user?.username]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.username) return;
    (async () => {
      try {
        setExpensesLoading(true);
        const res = await apiClient.get(`/expenses/user/${user!.username}`, { params: { filter_by: "upcoming", limit: 6 } });
        setUpcomingExpenses(res.data["user-expenses"] ?? []);
      } catch { /* silent */ } finally { setExpensesLoading(false); }
    })();
  }, [isLoaded, isSignedIn, user?.username]);

  useEffect(() => {
    (async () => {
      try {
        setFxLoading(true);
        const today = new Date();
        const start = new Date();
        start.setDate(today.getDate() - 14);
        const startStr = start.toISOString().split("T")[0];

        const [latestRes, seriesRes] = await Promise.all([
          fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL"),
          fetch(`https://api.frankfurter.dev/v1/${startStr}..?base=USD&symbols=BRL`),
        ]);
        const latestJson: FrankfurterLatest      = await latestRes.json();
        const seriesJson: FrankfurterTimeSeries  = await seriesRes.json();

        setLatestRate(latestJson.rates.BRL);
        setFxSeries(
          Object.entries(seriesJson.rates)
            .map(([date, rates]) => ({ date: date.slice(5), value: rates.BRL }))
            .sort((a, b) => a.date.localeCompare(b.date))
        );
      } catch { /* silent */ } finally { setFxLoading(false); }
    })();
  }, []);

  async function handleSubmitQuoteAlert() {
    if (!user?.username) return;
    const parsed = Number(targetQuote);
    if (!targetQuote || Number.isNaN(parsed) || parsed <= 0) return;
    const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
    if (!email) return;
    try {
      setIsSubmittingQuote(true);
      await apiClient.post("/fx/alerts", { username: user.username, email, target_rate: parsed });
      setTargetQuote("");
    } catch { /* silent */ } finally { setIsSubmittingQuote(false); }
  }

  if (!isLoaded) return <div style={{ minHeight: "100vh", background: C.bg }} />;
  if (!isSignedIn || !user) return null;

  const previousRate  = fxSeries.length >= 2 ? fxSeries[fxSeries.length - 2].value : null;
  const rateChange    = latestRate !== null && previousRate !== null ? latestRate - previousRate : null;
  const rateUp        = (rateChange ?? 0) >= 0;

  const schedulerBillsCount = dashboardSummary?.count ?? 0;
  const nextLiability       = dashboardSummary?.next_liability ?? null;
  function getCategoryIcon(category: string | null) {
    switch (category) {
      case "Education": return <School  size={18} />;
      case "Housing":   return <House   size={18} />;
      case "Food":      return <ShoppingCart size={18} />;
      default:          return <ScrollText  size={18} />;
    }
  }

  function getStatusBadge(e: Liability) {
    if (e.is_paid) return (
      <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}>Paid</span>
    );
    if (new Date(e.due_date) < new Date()) return (
      <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>Overdue</span>
    );
    return (
      <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(162,123,92,0.15)", color: C.rose }}>Upcoming</span>
    );
  }

  function formatDate(d: string) {
    const p = new Date(d);
    if (Number.isNaN(p.getTime())) return d;
    return p.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans antialiased" style={{ background: C.bg }}>
      <Navbar />

      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header
          className="flex h-12 shrink-0 items-center justify-between px-4 sm:px-5 lg:px-6"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <h2 className="text-lg font-bold" style={{ color: C.cream }}>Dashboard</h2>

          <div className="flex items-center gap-4">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
              style={{ border: `1px solid ${C.border}`, color: C.muted }}
            >
              <Bell size={16} />
            </button>

            <div className="flex items-center gap-3" style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: "1rem" }}>
              <span className="hidden text-sm font-semibold sm:block" style={{ color: C.cream }}>
                {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.username}
              </span>
              <img className="h-9 w-9 rounded-full object-cover" style={{ border: `2px solid rgba(162,123,92,0.3)` }} src={user.imageUrl} alt="" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full space-y-3 p-3 sm:p-4 lg:p-5">

            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

              {/* Scheduled bills */}
              <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: C.muted }}>Scheduled Bills</p>
                <p className="text-3xl font-black" style={{ color: C.cream }}>
                  {dashboardSummaryLoading ? "—" : schedulerBillsCount}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-sm font-medium" style={{ color: "#34d399" }}>
                  <TrendingUp size={14} />
                  <span>Unpaid confirmed expenses</span>
                </div>
              </div>

              {/* Next payment */}
              <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: C.muted }}>Next Payment Due</p>
                <p className="text-3xl font-black" style={{ color: C.cream }}>
                  {dashboardSummaryLoading ? "—" : nextLiability ? formatDate(nextLiability.due_date) : "None"}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-sm font-medium" style={{ color: C.rose }}>
                  <Clock size={14} />
                  <span>
                    {dashboardSummaryLoading ? "Loading..." : nextLiability
                      ? `${nextLiability.currency} ${nextLiability.amount} — ${nextLiability.name}`
                      : "You're all caught up"}
                  </span>
                </div>
              </div>

              {/* Rate alert */}
              <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: C.muted }}>Set Rate Alert</p>
                <input
                  value={targetQuote}
                  onChange={e => setTargetQuote(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-transparent px-0 text-2xl font-black outline-none placeholder:opacity-30"
                  style={{ color: C.cream, caretColor: C.rose }}
                  placeholder="5.0000"
                  type="number"
                  step="0.0001"
                />
                <div className="mt-3">
                  <button
                    onClick={handleSubmitQuoteAlert}
                    disabled={isSubmittingQuote}
                    className="rounded-xl px-5 py-2 text-sm font-bold transition-colors disabled:opacity-50"
                    style={{ background: C.rose, color: C.bg }}
                  >
                    {isSubmittingQuote ? "Saving…" : "Save Alert"}
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom grid */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">

              {/* Upcoming expenses */}
              <div className="flex flex-col gap-2 lg:col-span-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold" style={{ color: C.cream }}>Upcoming Expenses</h4>
                  <Link className="text-xs font-semibold transition-colors" style={{ color: C.rose }} to="/expenses">
                    View All
                  </Link>
                </div>

                <div className="space-y-2">
                  {expensesLoading ? (
                    <div className="rounded-2xl p-3 text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
                      Loading…
                    </div>
                  ) : upcomingExpenses.length === 0 ? (
                    <div className="rounded-2xl p-3 text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
                      No upcoming expenses.
                    </div>
                  ) : upcomingExpenses.map(expense => (
                    <div key={expense.id} className="flex items-center gap-3 rounded-2xl p-3"
                      style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: "rgba(162,123,92,0.12)", color: C.rose }}>
                        {getCategoryIcon(expense.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" style={{ color: C.cream }}>{expense.name}</p>
                        <p className="text-xs" style={{ color: C.muted }}>Due {expense.due_date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: C.cream }}>{expense.currency} {expense.amount}</p>
                        {getStatusBadge(expense)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FX chart */}
              <div className="flex flex-col gap-2 lg:col-span-8">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold" style={{ color: C.cream }}>Market Watch — USD / BRL</h4>
                </div>

                <div className="flex flex-col rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}`, minHeight: 220 }}>
                  {fxLoading ? (
                    <div className="flex flex-1 items-center justify-center text-sm" style={{ color: C.muted }}>
                      Loading FX data…
                    </div>
                  ) : (
                    <>
                      {/* Rate + change */}
                      <div className="mb-3 flex items-center gap-4">
                        <div>
                          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Rate</p>
                          <p className="text-2xl font-black" style={{ color: C.cream }}>
                            {latestRate?.toFixed(4) ?? "—"}
                            <span className="ml-1.5 text-sm font-normal" style={{ color: C.muted }}>BRL</span>
                          </p>
                        </div>
                        <div style={{ width: 1, height: 40, background: C.border }} />
                        <div>
                          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>24h Change</p>
                          <p className="flex items-center gap-1.5 text-2xl font-black"
                            style={{ color: rateUp ? "#34d399" : "#f87171" }}>
                            {rateUp ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                            {rateChange !== null ? rateChange.toFixed(4) : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Recharts area chart */}
                      <div className="flex-1" style={{ minHeight: 135 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={fxSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="fxGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#A27B5C" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#A27B5C" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="rgba(162,123,92,0.06)" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "rgba(220,215,201,0.4)", fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              domain={["auto", "auto"]}
                              tick={{ fill: "rgba(220,215,201,0.4)", fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={v => v.toFixed(2)}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(162,123,92,0.2)", strokeWidth: 1 }} />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#A27B5C"
                              strokeWidth={2}
                              fill="url(#fxGradient)"
                              dot={false}
                              activeDot={{ r: 4, fill: "#A27B5C", stroke: "#2C3930", strokeWidth: 2 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
