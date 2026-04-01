import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react-router";
import Navbar from "../components/Navbar";
import {
  ArrowRight,
  Flag,
  HelpCircle,
  Info,
  Bell,
  Route,
  Clock3,
  HandCoins,
} from "lucide-react";
import apiClient from "../API/client";

type ProviderRatesResponse = {
  crebit: number | null;
  wise: number | null;
  remitly: number | null;
};

type ProviderKey = "crebit" | "wise" | "remitly";

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

const providerLabelMap: Record<ProviderKey, string> = {
  crebit: "Crebit",
  wise: "Wise",
  remitly: "Remitly",
};

const providerEtaMap: Record<ProviderKey, string> = {
  crebit: "< 1 business day",
  wise: "1-2 business days",
  remitly: "Minutes to 3 business days",
};

const providerFeeMap: Record<ProviderKey, number> = {
  crebit: 0,
  wise: 18,
  remitly: 0,
};

const providerImpactMap: Record<ProviderKey, string> = {
  crebit: "Best for fast conversion",
  wise: "Traditional transfer route",
  remitly: "Promotional consumer rate",
};

const providerBorderMap: Record<ProviderKey, string> = {
  crebit: "border-blue-700",
  wise: "border-slate-200 dark:border-slate-800",
  remitly: "border-slate-200 dark:border-slate-800",
};

const providerLogoMap: Record<ProviderKey, string> = {
  crebit: "./crebit-logo.png",
  wise: "./wise-logo.png",
  remitly: "./remitly-logo.png",
};

export default function TransferRoutesPage() {
  const { user, isLoaded, isSignedIn } = useUser();

  const [rates, setRates] = useState<ProviderRatesResponse>({
    crebit: null,
    wise: null,
    remitly: null,
  });

  const [loadingRates, setLoadingRates] = useState(true);

  const [bills, setBills] = useState<Liability[]>([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [selectedBillId, setSelectedBillId] = useState<number | null>(null);

  const [leftProvider, setLeftProvider] = useState<ProviderKey>("crebit");
  const [rightProvider, setRightProvider] = useState<ProviderKey>("wise");

  useEffect(() => {
    async function fetchRates() {
      try {
        setLoadingRates(true);

        const response = await apiClient.get("/fx/rates");

        setRates({
          crebit:
            response.data?.crebit?.rate !== null &&
            response.data?.crebit?.rate !== undefined
              ? Number(response.data.crebit.rate)
              : null,
          wise:
            response.data?.wise?.rate !== null &&
            response.data?.wise?.rate !== undefined
              ? Number(response.data.wise.rate)
              : null,
          remitly:
            response.data?.remitly?.rate !== null &&
            response.data?.remitly?.rate !== undefined
              ? Number(response.data.remitly.rate)
              : null,
        });
      } catch (error) {
        console.error("Failed to fetch provider rates:", error);
      } finally {
        setLoadingRates(false);
      }
    }

    fetchRates();
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.username) return;

    async function fetchBills() {
      try {
        setLoadingBills(true);

        const response = await apiClient.get(`/expenses/user/${user?.username}`, {
          params: {
            filter_by: "all",
          },
        });

        const fetchedBills: Liability[] = response.data?.["user-expenses"] ?? [];
        setBills(fetchedBills);

        if (fetchedBills.length > 0) {
          setSelectedBillId((current) => current ?? fetchedBills[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch user bills:", error);
      } finally {
        setLoadingBills(false);
      }
    }

    fetchBills();
  }, [isLoaded, isSignedIn, user]);

  const selectedBill = useMemo(() => {
    return bills.find((bill) => bill.id === selectedBillId) ?? null;
  }, [bills, selectedBillId]);

  const bestProvider = useMemo(() => {
    const entries = [
      { name: "crebit", rate: rates.crebit },
      { name: "wise", rate: rates.wise },
      { name: "remitly", rate: rates.remitly },
    ].filter(
      (x): x is { name: string; rate: number } =>
        typeof x.rate === "number" && !Number.isNaN(x.rate)
    );

    if (entries.length === 0) return null;

    return entries.reduce((best, current) =>
      current.rate > best.rate ? current : best
    );
  }, [rates]);

  const comparison = useMemo(() => {
    if (!selectedBill) return null;

    const leftRate = rates[leftProvider];
    const rightRate = rates[rightProvider];

    if (
      leftRate === null ||
      rightRate === null ||
      Number.isNaN(leftRate) ||
      Number.isNaN(rightRate)
    ) {
      return null;
    }

    const leftFee = providerFeeMap[leftProvider];
    const rightFee = providerFeeMap[rightProvider];

    const billAmountUsd = selectedBill.amount;

    const leftNetUsd = Math.max(billAmountUsd - leftFee, 0);
    const rightNetUsd = Math.max(billAmountUsd - rightFee, 0);

    const leftTotalBrl = leftNetUsd * leftRate;
    const rightTotalBrl = rightNetUsd * rightRate;

    const winner = leftTotalBrl >= rightTotalBrl ? leftProvider : rightProvider;

    const savings = Math.abs(leftTotalBrl - rightTotalBrl);

    return {
      leftRate,
      rightRate,
      leftFee,
      rightFee,
      leftTotalBrl,
      rightTotalBrl,
      winner,
      savings,
    };
  }, [selectedBill, leftProvider, rightProvider, rates]);

  function formatRate(rate: number | null) {
    if (rate === null || Number.isNaN(rate)) {
      return loadingRates ? "Loading..." : "Unavailable";
    }
    return `1 USD = ${rate.toFixed(4)} BRL`;
  }

  function getBadge(provider: ProviderKey) {
    if (!bestProvider) return null;
    if (bestProvider.name !== provider) return null;

    return (
      <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700 dark:bg-green-900/30 dark:text-green-400">
        Recommended
      </span>
    );
  }

  function getProviderCard(provider: ProviderKey) {
    const isBest = bestProvider?.name === provider;

    return (
      <div
        className={`flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm transition-all hover:border-slate-300 dark:bg-slate-900 dark:hover:border-slate-700 md:flex-row md:items-center md:gap-6 ${
          isBest
            ? "border-2 border-blue-700 shadow-lg shadow-blue-700/5"
            : providerBorderMap[provider]
        }`}
      >
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <img
            src={providerLogoMap[provider]}
            className="h-12 w-12 rounded-md object-contain"
            alt={`${providerLabelMap[provider]} logo`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-xl font-bold">{providerLabelMap[provider]}</h4>
            {getBadge(provider)}
          </div>

          <div className="flex flex-col gap-2 text-sm text-slate-500 dark:text-slate-400 md:flex-row md:flex-wrap md:items-center md:gap-4">
            <div className="flex items-center gap-1">
              <span>{formatRate(rates[provider])}</span>
            </div>

            <div className="flex items-center gap-1">
              <Clock3 className="h-4 w-4" />
              <span>{providerEtaMap[provider]}</span>
            </div>

            <div className="flex items-center gap-1">
              <HandCoins className="h-4 w-4" />
              <span>Fee: ${providerFeeMap[provider]}</span>
            </div>
          </div>
        </div>

        <div className="text-left md:text-right">
          <div
            className={`rounded-lg px-3 py-2 ${
              isBest
                ? "border border-blue-100 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-900/20"
                : "border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
            }`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-tight ${
                isBest
                  ? "text-blue-700 dark:text-blue-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Estimated Impact
            </p>
            <p
              className={`text-sm font-bold ${
                isBest
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {providerImpactMap[provider]}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 font-display text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex h-screen overflow-hidden">
        <Navbar />

        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <Route className="h-5 w-5 text-blue-700" />
              <h2 className="text-xl font-bold tracking-tight">Transfer Routes</h2>
            </div>

            <div className="flex gap-3">
              <button className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <Bell className="h-5 w-5" />
              </button>
              <button className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <HelpCircle className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                Route Optimization Analysis
              </h3>
              <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
                Comparative breakdown of how current exchange routes affect your
                pending international student payments.
              </p>
            </div>

            <div className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:gap-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Sending From
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <Flag className="h-4 w-4 text-blue-600" />
                  <span className="font-bold">USD</span>
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-slate-300 dark:text-slate-600" />

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Receiving In
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <Flag className="h-4 w-4 text-green-600" />
                  <span className="font-bold">BRL</span>
                </div>
              </div>

              <div className="w-full sm:ml-auto sm:w-auto">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Best live rate:{" "}
                  {bestProvider
                    ? `${bestProvider.rate.toFixed(4)} BRL`
                    : "Loading..."}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {getProviderCard("crebit")}
              {getProviderCard("wise")}
              {getProviderCard("remitly")}
            </div>

            <section className="mt-12 border-t border-slate-200 pt-12 pb-8 dark:border-slate-800">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Compare Providers
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Calculate the impact on one of your actual bills using current
                provider quotes.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Select Bill
                  </label>
                  <select
                    value={selectedBillId ?? ""}
                    onChange={(e) => setSelectedBillId(Number(e.target.value))}
                    disabled={loadingBills || bills.length === 0}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-700 focus:ring-blue-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {loadingBills ? (
                      <option value="">Loading bills...</option>
                    ) : bills.length === 0 ? (
                      <option value="">No bills found</option>
                    ) : (
                      bills.map((bill) => (
                        <option key={bill.id} value={bill.id}>
                          {bill.name} (${bill.amount})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Left Provider
                  </label>
                  <select
                    value={leftProvider}
                    onChange={(e) => setLeftProvider(e.target.value as ProviderKey)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-700 focus:ring-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="crebit">Crebit</option>
                    <option value="wise">Wise</option>
                    <option value="remitly">Remitly</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Right Provider
                  </label>
                  <select
                    value={rightProvider}
                    onChange={(e) => setRightProvider(e.target.value as ProviderKey)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-700 focus:ring-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="crebit">Crebit</option>
                    <option value="wise">Wise</option>
                    <option value="remitly">Remitly</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80">
                        <th className="w-[34%] px-5 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          Metric{" "}
                          {selectedBill
                            ? `(for $${selectedBill.amount.toLocaleString()} ${selectedBill.currency})`
                            : ""}
                        </th>

                        <th
                          className={`w-[33%] px-5 py-4 text-sm font-bold ${
                            comparison?.winner === leftProvider
                              ? "bg-blue-50 text-slate-900 dark:bg-blue-900/20 dark:text-slate-100"
                              : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{providerLabelMap[leftProvider]}</span>
                            {comparison?.winner === leftProvider && (
                              <span className="inline-flex items-center rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter text-white">
                                Winner
                              </span>
                            )}
                          </div>
                        </th>

                        <th
                          className={`w-[33%] px-5 py-4 text-sm font-bold ${
                            comparison?.winner === rightProvider
                              ? "bg-blue-50 text-slate-900 dark:bg-blue-900/20 dark:text-slate-100"
                              : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{providerLabelMap[rightProvider]}</span>
                            {comparison?.winner === rightProvider && (
                              <span className="inline-flex items-center rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter text-white">
                                Winner
                              </span>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                          Bill Name
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {selectedBill?.name ?? "--"}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {selectedBill?.name ?? "--"}
                        </td>
                      </tr>

                      <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                          Exchange Rate
                        </td>
                        <td
                          className={`px-5 py-4 text-sm ${
                            comparison?.winner === leftProvider
                              ? "bg-blue-50 font-semibold dark:bg-blue-900/10"
                              : ""
                          }`}
                        >
                          {formatRate(rates[leftProvider])}
                        </td>
                        <td
                          className={`px-5 py-4 text-sm ${
                            comparison?.winner === rightProvider
                              ? "bg-blue-50 font-semibold dark:bg-blue-900/10"
                              : ""
                          }`}
                        >
                          {formatRate(rates[rightProvider])}
                        </td>
                      </tr>

                      <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                          Processing Fee
                        </td>
                        <td
                          className={`px-5 py-4 text-sm ${
                            comparison?.winner === leftProvider
                              ? "bg-blue-50 font-semibold dark:bg-blue-900/10"
                              : ""
                          }`}
                        >
                          ${comparison ? comparison.leftFee.toFixed(2) : "--"} USD
                        </td>
                        <td
                          className={`px-5 py-4 text-sm ${
                            comparison?.winner === rightProvider
                              ? "bg-blue-50 font-semibold dark:bg-blue-900/10"
                              : ""
                          }`}
                        >
                          ${comparison ? comparison.rightFee.toFixed(2) : "--"} USD
                        </td>
                      </tr>

                      <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                          Total in BRL
                        </td>
                        <td
                          className={`px-5 py-4 text-base font-extrabold ${
                            comparison?.winner === leftProvider
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/10 dark:text-blue-400"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {comparison
                            ? `R$ ${comparison.leftTotalBrl.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : "--"}
                        </td>
                        <td
                          className={`px-5 py-4 text-base font-extrabold ${
                            comparison?.winner === rightProvider
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/10 dark:text-blue-400"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {comparison
                            ? `R$ ${comparison.rightTotalBrl.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : "--"}
                        </td>
                      </tr>

                      <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                          Estimated Arrival (ETA)
                        </td>
                        <td
                          className={`px-5 py-4 text-sm italic ${
                            comparison?.winner === leftProvider
                              ? "bg-blue-50 font-medium dark:bg-blue-900/10"
                              : ""
                          }`}
                        >
                          {providerEtaMap[leftProvider]}
                        </td>
                        <td
                          className={`px-5 py-4 text-sm italic ${
                            comparison?.winner === rightProvider
                              ? "bg-blue-50 font-medium dark:bg-blue-900/10"
                              : ""
                          }`}
                        >
                          {providerEtaMap[rightProvider]}
                        </td>
                      </tr>

                      <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                          Due Date
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {selectedBill?.due_date ?? "--"}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {selectedBill?.due_date ?? "--"}
                        </td>
                      </tr>
                    </tbody>

                    <tfoot className="border-t-2 border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/10">
                      <tr>
                        <td className="px-5 py-5 text-sm font-bold italic text-slate-900 dark:text-slate-100">
                          Total Savings on This Bill
                        </td>
                        <td className="px-5 py-5" colSpan={2}>
                          <div className="flex flex-col">
                            <span className="text-xl font-black text-blue-700 dark:text-blue-400">
                              {comparison
                                ? `R$ ${comparison.savings.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : "--"}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-tighter text-blue-700/70 dark:text-blue-400/70">
                              Difference between selected providers
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </section>

            <div className="mt-12 flex items-start gap-6 rounded-xl border border-blue-700/20 bg-blue-700/5 p-6">
              <div className="rounded-full bg-blue-700/10 p-3 text-blue-700 dark:text-blue-400">
                <Info className="h-5 w-5" />
              </div>

              <div>
                <h5 className="mb-1 font-bold text-blue-700 dark:text-blue-400">
                  How routes are calculated
                </h5>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  These routes are populated from each provider&apos;s current quote
                  endpoint and compared side by side so you can quickly see which
                  service is offering the strongest USD to BRL rate currently.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}