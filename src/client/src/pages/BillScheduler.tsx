import { useState } from "react";
import {
  Banknote,
  TrendingDown,
  Wallet,
  CalendarClock,
  CircleDollarSign,
} from "lucide-react";
import Navbar from "../components/Navbar";

type BillRecommendation = "Pay Now" | "Wait" | "Track";

type ScheduledBill = {
  id: number;
  name: string;
  amountUsd: number;
  amountBrl: number;
  dueIn: string;
  recommendation: BillRecommendation;
  note: string;
  category: string;
};

const bills: ScheduledBill[] = [
  {
    id: 1,
    name: "Tuition Fee",
    amountUsd: 1200,
    amountBrl: 5940,
    dueIn: "Due in 12 days",
    recommendation: "Pay Now",
    note: "Rate is currently favorable; best price this month.",
    category: "Education",
  },
  {
    id: 2,
    name: "Monthly Rent",
    amountUsd: 850,
    amountBrl: 4207.5,
    dueIn: "Due in 24 days",
    recommendation: "Wait",
    note: "Rate is high; waiting may reduce your cost next week.",
    category: "Housing",
  },
  {
    id: 3,
    name: "Utility Package",
    amountUsd: 120,
    amountBrl: 594,
    dueIn: "Due in 3 days",
    recommendation: "Pay Now",
    note: "Due date is approaching; avoid late fees.",
    category: "Utilities",
  },
  {
    id: 4,
    name: "Health Insurance",
    amountUsd: 310,
    amountBrl: 1534.5,
    dueIn: "Due in 15 days",
    recommendation: "Track",
    note: "Rate may improve soon; monitor before paying.",
    category: "Insurance",
  },
];

type FilterType = "all" | "pay-now" | "wait" | "track";

export default function BillScheduler() {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");

  function formatCurrency(value: number, currency: "USD" | "BRL") {
    return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
      style: "currency",
      currency,
    }).format(value);
  }

  function getTabClass(filter: FilterType) {
    const isActive = selectedFilter === filter;

    return isActive
      ? "border-b-2 border-blue-700 px-4 py-3 text-sm font-bold text-blue-700 sm:px-6"
      : "border-b-2 border-transparent px-4 py-3 text-sm font-bold text-slate-400 transition-colors hover:text-slate-600 sm:px-6";
  }

  function getRecommendationBadge(recommendation: BillRecommendation) {
    switch (recommendation) {
      case "Pay Now":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "Wait":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "Track":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
  }

  const filteredBills = bills.filter((bill) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "pay-now") return bill.recommendation === "Pay Now";
    if (selectedFilter === "wait") return bill.recommendation === "Wait";
    if (selectedFilter === "track") return bill.recommendation === "Track";
    return true;
  });

  return (
    <div className="bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen overflow-hidden">
        <Navbar />

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <header className="flex flex-col justify-between gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:px-8">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Bill Scheduler
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 sm:text-base">
                Optimize when to pay your international bills based on FX timing
              </p>
            </div>

          </header>

          <div className="grid grid-cols-1 gap-4 px-4 py-2 sm:px-6 md:grid-cols-3 lg:px-8">
            <div className="rounded-2xl border border-blue-700/5 bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-blue-700/10 p-2 text-blue-700">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold tracking-wide text-slate-400 sm:text-xs">
                  CURRENT USD/BRL
                </span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                R$ 4.95
              </p>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                BRL strengthened 0.2% today
              </p>
            </div>

            <div className="rounded-2xl border border-blue-700/5 bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-yellow-100 p-2 text-yellow-600">
                  <CircleDollarSign className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold tracking-wide text-slate-400 sm:text-xs">
                  MARKET SIGNAL
                </span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                Bullish for BRL
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Market suggests more favorable BRL pricing this week
              </p>
            </div>
          </div>

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <div className="overflow-x-auto">
              <div className="flex min-w-max border-b border-blue-700/10">
                <button
                  className={getTabClass("all")}
                  onClick={() => setSelectedFilter("all")}
                >
                  All Bills
                </button>
                <button
                  className={getTabClass("pay-now")}
                  onClick={() => setSelectedFilter("pay-now")}
                >
                  Pay Now
                </button>
                <button
                  className={getTabClass("wait")}
                  onClick={() => setSelectedFilter("wait")}
                >
                  Wait
                </button>
                <button
                  className={getTabClass("track")}
                  onClick={() => setSelectedFilter("track")}
                >
                  Track
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-blue-700/5 bg-white shadow-sm dark:bg-slate-900">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-blue-700/10 bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                        Bill
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                        Due Date
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                        Amount (USD)
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-blue-700">
                        Est. BRL
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                        Recommendation
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-blue-700/5">
                    {filteredBills.map((bill) => (
                      <tr
                        key={bill.id}
                        className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-blue-700/10 p-2 text-blue-700">
                              <Banknote className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {bill.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {bill.category}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-300">
                          {bill.dueIn}
                        </td>

                        <td className="px-6 py-5 text-sm font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(bill.amountUsd, "USD")}
                        </td>

                        <td className="px-6 py-5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                          {formatCurrency(bill.amountBrl, "BRL")}
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`w-fit rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${getRecommendationBadge(
                                bill.recommendation
                              )}`}
                            >
                              {bill.recommendation}
                            </span>
                            <p className="max-w-xs text-xs leading-tight text-slate-500 dark:text-slate-400">
                              {bill.note}
                            </p>
                          </div>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <button className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white transition hover:opacity-90">
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
                    className="rounded-2xl border border-blue-700/10 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {bill.name}
                        </p>
                        <p className="text-xs text-slate-500">{bill.category}</p>
                      </div>
                      <span
                        className={`rounded px-2 py-1 text-[10px] font-black uppercase tracking-widest ${getRecommendationBadge(
                          bill.recommendation
                        )}`}
                      >
                        {bill.recommendation}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Due</span>
                        <span className="font-medium">{bill.dueIn}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">USD</span>
                        <span className="font-medium">
                          {formatCurrency(bill.amountUsd, "USD")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">BRL</span>
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          {formatCurrency(bill.amountBrl, "BRL")}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {bill.note}
                    </p>

                    <button className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
                      {bill.recommendation === "Pay Now"
                        ? "Pay Bill"
                        : bill.recommendation === "Wait"
                        ? "Schedule"
                        : "Track Rate"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}