import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/react-router";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Bell, Clock, House, School, ScrollText, ShoppingCart,
  TrendingDown, TrendingUp, DollarSign,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import apiClient from "../API/client";
import createUser from "../API/UserClient";

// ─── palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:    "#2C3930",
  deep:  "#1a2420",
  card:  "rgba(30,41,34,0.98)",
  cardAlt: "rgba(63,79,68,0.18)",
  border: "rgba(162,123,92,0.15)",
  rose:  "#A27B5C",
  cream: "#DCD7C9",
  muted: "rgba(220,215,201,0.5)",
  green: "#34d399",
  red:   "#f87171",
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

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, className = "", style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ background: C.card, border: `1px solid ${C.border}`, ...style }}
    >
      {children}
    </div>
  );
}

// ─── ReactBits: SpotlightCard ─────────────────────────────────────────────────
function SpotlightCard({ children, className = "", style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  const ref     = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !spotRef.current) return;
    spotRef.current.style.background =
      `radial-gradient(350px circle at ${e.clientX - rect.left}px ${e.clientY - rect.top}px, rgba(162,123,92,0.1), transparent 70%)`;
    spotRef.current.style.opacity = "1";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => { if (spotRef.current) spotRef.current.style.opacity = "0"; }}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      <div ref={spotRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0, transition: "opacity 0.3s", borderRadius: "inherit" }} />
      {children}
    </div>
  );
}

// ─── ReactBits: CountUp ───────────────────────────────────────────────────────
function CountUp({ to, decimals = 0, duration = 1200 }: { to: number; decimals?: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (to === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setVal((1 - Math.pow(1 - t, 3)) * to);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setVal(to);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [to, duration]);

  return <>{val.toFixed(decimals)}</>;
}

// ─── ReactBits: ShimmerButton ─────────────────────────────────────────────────
function ShimmerButton({ children, onClick, disabled }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.04 }}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      className="relative overflow-hidden rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-50 shrink-0"
      style={{ background: C.rose, color: C.bg }}
    >
      <motion.div
        style={{ position: "absolute", top: 0, bottom: 0, width: "50%", pointerEvents: "none",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)" }}
        animate={{ x: ["-130%", "280%"] }}
        transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
      />
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}

// ─── ReactBits: PulseDot ──────────────────────────────────────────────────────
function PulseDot({ color = C.green }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <motion.span className="absolute inline-flex h-full w-full rounded-full" style={{ background: color }}
        animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs font-semibold shadow-xl"
      style={{ background: C.deep, border: `1px solid ${C.border}`, color: C.cream }}>
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
        const res = await apiClient.get(`/expenses/user/${user!.username}`, { params: { filter_by: "upcoming", limit: 10 } });
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
        const latestJson: FrankfurterLatest     = await latestRes.json();
        const seriesJson: FrankfurterTimeSeries = await seriesRes.json();
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

  const previousRate = fxSeries.length >= 2 ? fxSeries[fxSeries.length - 2].value : null;
  const rateChange   = latestRate !== null && previousRate !== null ? latestRate - previousRate : null;
  const rateUp       = (rateChange ?? 0) >= 0;

  const schedulerBillsCount = dashboardSummary?.count ?? 0;
  const nextLiability       = dashboardSummary?.next_liability ?? null;

  function getCategoryIcon(category: string | null) {
    switch (category) {
      case "Education": return <School       size={16} />;
      case "Housing":   return <House        size={16} />;
      case "Food":      return <ShoppingCart size={16} />;
      default:          return <ScrollText   size={16} />;
    }
  }

  function getStatusBadge(e: Liability) {
    if (e.is_paid) return (
      <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(52,211,153,0.15)", color: C.green }}>Paid</span>
    );
    if (new Date(e.due_date) < new Date()) return (
      <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(248,113,113,0.15)", color: C.red }}>Overdue</span>
    );
    return (
      <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(162,123,92,0.15)", color: C.rose }}>Due</span>
    );
  }

  function formatDate(d: string) {
    const p = new Date(d);
    if (Number.isNaN(p.getTime())) return d;
    return p.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }


  return (
    <div className="flex h-screen overflow-hidden font-sans antialiased" style={{ background: C.bg }}>
      <Navbar />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header
          className="flex h-12 shrink-0 items-center justify-between px-4 sm:px-5"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <h2 className="text-lg font-black" style={{ color: C.cream }}>Dashboard</h2>

          <div className="flex items-center gap-3">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ border: `1px solid ${C.border}`, color: C.muted }}
            >
              <Bell size={15} />
            </button>
            <div className="flex items-center gap-2.5" style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: "0.75rem" }}>
              <span className="hidden text-sm font-semibold sm:block" style={{ color: C.cream }}>
                {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.username}
              </span>
              <img className="h-8 w-8 rounded-full object-cover" style={{ border: `2px solid rgba(162,123,92,0.3)` }} src={user.imageUrl} alt="" />
            </div>
          </div>
        </header>

        {/* ── Main ───────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden min-h-0">
          <div className="flex flex-col h-full p-3 gap-3">

            {/* ── Stat Cards ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 shrink-0">

              {/* Scheduled Bills */}
              <Card>
                <motion.div className="p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(52,211,153,0.1)", color: C.green }}>
                      <TrendingUp size={16} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-right leading-tight" style={{ color: C.muted }}>
                      Scheduled<br />Bills
                    </span>
                  </div>
                  <p className="text-4xl font-black" style={{ color: C.cream }}>
                    {dashboardSummaryLoading ? "—" : <CountUp to={schedulerBillsCount} />}
                  </p>
                  <p className="mt-1.5 text-xs font-medium" style={{ color: C.green }}>Unpaid confirmed</p>
                </motion.div>
              </Card>

              {/* Next Payment */}
              <Card>
                <motion.div className="p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(162,123,92,0.12)", color: C.rose }}>
                      <Clock size={16} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-right leading-tight" style={{ color: C.muted }}>
                      Next<br />Payment
                    </span>
                  </div>
                  <p className="text-4xl font-black leading-tight" style={{ color: C.cream }}>
                    {dashboardSummaryLoading ? "—" : nextLiability ? formatDate(nextLiability.due_date) : "None"}
                  </p>
                  <p className="mt-1.5 text-xs font-medium truncate" style={{ color: C.rose }}>
                    {dashboardSummaryLoading ? "Loading…" : nextLiability
                      ? `${nextLiability.currency} ${nextLiability.amount} · ${nextLiability.name}`
                      : "All clear"}
                  </p>
                </motion.div>
              </Card>

              {/* FX Rate */}
              <Card>
                <motion.div className="p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(162,123,92,0.12)", color: C.rose }}>
                        <DollarSign size={16} />
                      </div>
                      <PulseDot color={C.green} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-right leading-tight" style={{ color: C.muted }}>
                      USD / BRL<br />Live Rate
                    </span>
                  </div>
                  <p className="text-4xl font-black" style={{ color: C.cream }}>
                    {fxLoading ? "—" : <CountUp to={latestRate ?? 0} decimals={4} />}
                  </p>
                  <p className="mt-1.5 text-xs font-medium" style={{ color: C.muted }}>Brazilian Real per Dollar</p>
                </motion.div>
              </Card>
            </div>

            {/* ── Main Content Grid ───────────────────────────────────────────── */}
            <div className="flex-1 grid gap-3 min-h-0" style={{ gridTemplateColumns: "5fr 7fr" }}>

              {/* Left: Upcoming Expenses */}
              <Card className="min-h-0 flex flex-col p-4">
                <div className="shrink-0 flex items-center justify-between mb-3">
                  <h4 className="text-base font-bold" style={{ color: C.cream }}>Upcoming Expenses</h4>
                  <Link className="text-xs font-semibold" style={{ color: C.rose }} to="/expenses">
                    View All →
                  </Link>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-0.5" style={{ scrollbarWidth: "none" as const }}>
                  {expensesLoading ? (
                    <div className="flex items-center justify-center h-full text-sm" style={{ color: C.muted }}>Loading…</div>
                  ) : upcomingExpenses.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm" style={{ color: C.muted }}>No upcoming expenses.</div>
                  ) : upcomingExpenses.map((expense, i) => (
                    <motion.div key={expense.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.055 }}>
                      <SpotlightCard
                        className="flex items-center gap-3 rounded-xl p-3 cursor-default"
                        style={{ background: C.cardAlt, border: `1px solid rgba(162,123,92,0.1)` }}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: "rgba(162,123,92,0.12)", color: C.rose }}>
                          {getCategoryIcon(expense.category)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold" style={{ color: C.cream }}>{expense.name}</p>
                          <p className="text-xs" style={{ color: C.muted }}>{expense.due_date}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold" style={{ color: C.cream }}>{expense.currency} {expense.amount}</p>
                          {getStatusBadge(expense)}
                        </div>
                      </SpotlightCard>
                    </motion.div>
                  ))}
                </div>
              </Card>

              {/* Right: FX Chart + Rate Alert */}
              <Card className="min-h-0 flex flex-col p-4">
                <div className="shrink-0 flex items-center justify-between mb-3">
                  <h4 className="text-base font-bold" style={{ color: C.cream }}>Market Watch — USD / BRL</h4>
                  <div className="flex items-center gap-2">
                    <PulseDot color={C.green} />
                    <span className="text-xs" style={{ color: C.muted }}>Live</span>
                  </div>
                </div>

                {/* Rate + change */}
                {!fxLoading && (
                  <div className="shrink-0 flex items-center gap-5 mb-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: C.muted }}>Rate</p>
                      <p className="text-2xl font-black" style={{ color: C.cream }}>
                        {latestRate?.toFixed(4) ?? "—"}
                        <span className="ml-1 text-sm font-normal" style={{ color: C.muted }}>BRL</span>
                      </p>
                    </div>
                    <div style={{ width: 1, height: 36, background: C.border }} />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: C.muted }}>24h Change</p>
                      <p className="flex items-center gap-1 text-2xl font-black" style={{ color: rateUp ? C.green : C.red }}>
                        {rateUp ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                        {rateChange !== null ? (rateUp ? "+" : "") + rateChange.toFixed(4) : "—"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Chart */}
                <div className="flex-1 min-h-0">
                  {fxLoading ? (
                    <div className="flex items-center justify-center h-full text-sm" style={{ color: C.muted }}>Loading FX data…</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={fxSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="fxGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#A27B5C" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#A27B5C" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="rgba(162,123,92,0.06)" />
                        <XAxis dataKey="date" tick={{ fill: "rgba(220,215,201,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis domain={["auto", "auto"]} tick={{ fill: "rgba(220,215,201,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(162,123,92,0.2)", strokeWidth: 1 }} />
                        <Area type="monotone" dataKey="value" stroke="#A27B5C" strokeWidth={2} fill="url(#fxGradient)" dot={false}
                          activeDot={{ r: 4, fill: "#A27B5C", stroke: C.deep, strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Rate Alert */}
                <div className="shrink-0 mt-3 pt-3 flex items-center gap-3" style={{ borderTop: `1px solid ${C.border}` }}>
                  <Bell size={14} className="shrink-0" style={{ color: C.muted }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest shrink-0" style={{ color: C.muted }}>Rate Alert</p>
                  <input
                    value={targetQuote}
                    onChange={e => setTargetQuote(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-bold outline-none placeholder:opacity-30 min-w-0"
                    style={{ color: C.cream, caretColor: C.rose }}
                    placeholder="Target rate (e.g. 5.0000)"
                    type="number"
                    step="0.0001"
                  />
                  <ShimmerButton onClick={handleSubmitQuoteAlert} disabled={isSubmittingQuote}>
                    {isSubmittingQuote ? "Saving…" : "Save Alert"}
                  </ShimmerButton>
                </div>
              </Card>
            </div>


          </div>
        </main>
      </div>
    </div>
  );
}
