import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react-router";
import {
  BellDot,
  Clock,
  House,
  School,
  ScrollText,
  Search,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import Navbar from "../components/Navbar";
import apiClient from "../API/client";

type Liability = {
  id: number;
  username: string;
  name: string;
  amount: number;
  currency: string;
  due_date: string;
  is_predicted: boolean;
  is_paid: boolean;
  category: string | null;
  priority_level: number;
  created_at: string;
};

type FrankfurterTimeSeries = {
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, { BRL: number }>;
};

type FrankfurterLatest = {
  base: string;
  date: string;
  rates: {
    BRL: number;
  };
};

export default function Dashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const navigate = useNavigate();

  const [upcomingExpenses, setUpcomingExpenses] = useState<Liability[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

  const [fxSeries, setFxSeries] = useState<{ date: string; value: number }[]>([]);
  const [latestRate, setLatestRate] = useState<number | null>(null);
  const [fxLoading, setFxLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && (!isSignedIn || !user)) {
      navigate("/");
    }
  }, [isLoaded, isSignedIn, user, navigate]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    async function fetchUpcomingExpenses() {
      try {
        setExpensesLoading(true);

        const response = await apiClient.get("/get-user-expenses", {
          params: {
            filter_by: "upcoming",
            limit: 3,
            username: user?.username,
          },
        });

        setUpcomingExpenses(response.data["user-expenses"] ?? []);
      } catch (error) {
        console.error("Failed to fetch upcoming expenses:", error);
      } finally {
        setExpensesLoading(false);
      }
    }

    fetchUpcomingExpenses();
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    async function fetchFxData() {
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

        const latestJson: FrankfurterLatest = await latestRes.json();
        const seriesJson: FrankfurterTimeSeries = await seriesRes.json();

        setLatestRate(latestJson.rates.BRL);

        const points = Object.entries(seriesJson.rates)
          .map(([date, rates]) => ({
            date,
            value: rates.BRL,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setFxSeries(points);
      } catch (error) {
        console.error("Failed to fetch FX data:", error);
      } finally {
        setFxLoading(false);
      }
    }

    fetchFxData();
  }, []);

  const chartData = useMemo(() => {
    if (fxSeries.length === 0) return { linePath: "", areaPath: "", labels: [], peak: null };

    const width = 400;
    const height = 150;
    const values = fxSeries.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 0.0001);

    const points = fxSeries.map((point, index) => {
      const x = (index / Math.max(fxSeries.length - 1, 1)) * width;
      const y = height - ((point.value - min) / range) * (height - 20) - 10;
      return { ...point, x, y };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
      .join(" ");

    const areaPath = `${linePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

    const peak = points.reduce((best, current) =>
      current.value > best.value ? current : best
    );

    const labels = [
      points[0],
      points[Math.floor(points.length / 2)],
      points[points.length - 1],
    ].filter(Boolean);

    return { linePath, areaPath, labels, peak };
  }, [fxSeries]);

  if (!isLoaded) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  if (!isSignedIn || !user) {
    return null;
  }

  function getCategoryIcon(category: string | null) {
    switch (category) {
      case "Education":
        return <School className="h-5 w-5" />;
      case "Housing":
        return <House className="h-5 w-5" />;
      case "Food":
        return <ShoppingCart className="h-5 w-5" />;
      default:
        return <ScrollText className="h-5 w-5" />;
    }
  }

  function getStatusBadge(expense: Liability) {
    if (expense.is_paid) {
      return (
        <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-300">
          Paid
        </span>
      );
    }

    const isOverdue = new Date(expense.due_date) < new Date();

    if (isOverdue) {
      return (
        <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] text-red-700 dark:bg-red-900/30 dark:text-red-300">
          Overdue
        </span>
      );
    }

    return (
      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
        Upcoming
      </span>
    );
  }

  const previousRate =
    fxSeries.length >= 2 ? fxSeries[fxSeries.length - 2].value : null;
  const rateChange =
    latestRate !== null && previousRate !== null ? latestRate - previousRate : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex h-screen overflow-hidden">
        <Navbar />

        <main className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-8 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">Dashboard Overview</h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="h-5 w-5" />
                </span>
                <input
                  className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-700 focus:ring-blue-700 dark:border-slate-800 dark:bg-slate-900"
                  placeholder="Search transactions..."
                  type="text"
                />
              </div>

              <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <BellDot className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 border-l border-slate-200 pl-2 dark:border-slate-800">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold">
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.username}
                  </p>
                </div>
                <img
                  className="h-10 w-10 rounded-full border-2 border-blue-700/20 object-cover"
                  alt="Student profile"
                  src={user.imageUrl}
                />
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-8 p-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="absolute right-0 top-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-blue-700/5 transition-transform group-hover:scale-110" />
                <p className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Available Balance
                </p>
                <h3 className="text-3xl font-bold tracking-tight">$4,250.00</h3>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-500">
                  <TrendingUp className="h-4 w-4" />
                  <span>+12.5% from last month</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Next Payment Due
                </p>
                <h3 className="text-3xl font-bold tracking-tight">Oct 15, 2023</h3>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-500">
                  <Clock className="h-4 w-4" />
                  <span>$2,500.00 Tuition Fee</span>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl bg-blue-700 p-6 text-white shadow-lg shadow-blue-700/20">
                <div>
                  <p className="mb-1 text-sm font-medium text-white/80">
                    Exchange Reward Balance
                  </p>
                  <h3 className="text-3xl font-bold tracking-tight">840 pts</h3>
                </div>
                <button className="mt-4 w-full rounded-lg bg-white/20 py-2 text-sm font-semibold transition-colors hover:bg-white/30">
                  Redeem Rewards
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="flex flex-col gap-4 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold">Upcoming Expenses</h4>
                  <Link className="text-sm font-semibold text-blue-700 hover:underline" to="/expenses">
                    View All
                  </Link>
                </div>

                <div className="space-y-3">
                  {expensesLoading ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                      Loading upcoming expenses...
                    </div>
                  ) : upcomingExpenses.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                      No upcoming expenses found.
                    </div>
                  ) : (
                    upcomingExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                          {getCategoryIcon(expense.category)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{expense.name}</p>
                          <p className="text-xs text-slate-500">Due {expense.due_date}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold">
                            {expense.currency} {expense.amount}
                          </p>
                          {getStatusBadge(expense)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold">Market Watch (USD/BRL)</h4>
                  <div className="flex gap-2">
                    <button className="rounded-full bg-blue-700 px-3 py-1 text-xs font-medium text-white">
                      2W
                    </button>
                  </div>
                </div>

                <div className="flex min-h-[300px] flex-1 flex-col rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  {fxLoading ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                      Loading FX data...
                    </div>
                  ) : (
                    <>
                      <div className="mb-8 flex items-center gap-6">
                        <div>
                          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">
                            Rate
                          </p>
                          <p className="text-2xl font-bold">
                            {latestRate?.toFixed(4) ?? "--"}
                            <span className="ml-1 text-sm font-normal text-slate-400">
                              BRL
                            </span>
                          </p>
                        </div>

                        <div className="h-10 w-px bg-slate-200 dark:bg-slate-800" />

                        <div>
                          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">
                            Change
                          </p>
                          <p
                            className={`text-2xl font-bold ${
                              (rateChange ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"
                            }`}
                          >
                            {rateChange !== null ? rateChange.toFixed(4) : "--"}
                          </p>
                        </div>
                      </div>

                      <div className="relative flex flex-1 items-end pt-10">
                        <div className="absolute inset-0 flex flex-col justify-between py-2 opacity-10">
                          <div className="h-px w-full bg-slate-400" />
                          <div className="h-px w-full bg-slate-400" />
                          <div className="h-px w-full bg-slate-400" />
                          <div className="h-px w-full bg-slate-400" />
                        </div>

                        <svg
                          className="absolute inset-0 h-full w-full overflow-visible"
                          preserveAspectRatio="none"
                          viewBox="0 0 400 150"
                        >
                          <defs>
                            <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                              <stop offset="0%" stopColor="#1152d4" stopOpacity="0.2" />
                              <stop offset="100%" stopColor="#1152d4" stopOpacity="0" />
                            </linearGradient>
                          </defs>

                          <path
                            d={chartData.linePath}
                            fill="none"
                            stroke="#1152d4"
                            strokeWidth="3"
                          />
                          <path d={chartData.areaPath} fill="url(#chartGradient)" />

                          {chartData.peak && (
                            <circle
                              cx={chartData.peak.x}
                              cy={chartData.peak.y}
                              fill="#1152d4"
                              r="5"
                            />
                          )}
                        </svg>

                        {chartData.peak && (
                          <div
                            className="pointer-events-none absolute rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white shadow-lg"
                            style={{
                              left: `${Math.min(chartData.peak.x, 330)}px`,
                              top: "16px",
                            }}
                          >
                            Peak {chartData.peak.value.toFixed(4)}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex justify-between text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                        {chartData.labels.map((label) => (
                          <span key={label.date}>{label.date.slice(5)}</span>
                        ))}
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
