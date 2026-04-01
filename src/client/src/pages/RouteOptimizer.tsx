import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react-router";
import Navbar from "../components/Navbar";
import {
  ArrowRight,
  Bell,
  Clock3,
  HandCoins,
  HelpCircle,
  Info,
  Route,
  ScrollText,
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

// ─── palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#2C3930",
  surface: "rgba(63,79,68,0.18)",
  surfaceStrong: "rgba(63,79,68,0.28)",
  border: "rgba(162,123,92,0.10)",
  rose: "#A27B5C",
  cream: "#DCD7C9",
  muted: "rgba(220,215,201,0.50)",
  mutedStrong: "rgba(220,215,201,0.72)",
  success: "#34d399",
  danger: "#f87171",
};

const providerLabelMap: Record<ProviderKey, string> = {
  crebit: "Crebit",
  wise: "Wise",
  remitly: "Remitly",
};

const providerEtaMap: Record<ProviderKey, string> = {
  crebit: "< 1 business day",
  wise: "1–2 business days",
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

        const response = await apiClient.get(`/expenses/user/${user.username}`, {
          params: { filter_by: "all" },
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
      (x): x is { name: ProviderKey; rate: number } =>
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

  function formatBrl(value: number) {
    return `R$ ${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function getBadge(provider: ProviderKey) {
    if (!bestProvider || bestProvider.name !== provider) return null;

    return (
      <span
        className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        style={{
          background: "rgba(52,211,153,0.15)",
          color: C.success,
        }}
      >
        Recommended
      </span>
    );
  }

  function getProviderCard(provider: ProviderKey) {
    const isBest = bestProvider?.name === provider;

    return (
      <div
        className="flex flex-col gap-4 rounded-2xl p-5 transition-all md:flex-row md:items-center md:gap-6"
        style={{
          background: C.surface,
          border: `1px solid ${isBest ? C.rose : C.border}`,
          boxShadow: isBest ? "0 0 0 1px rgba(162,123,92,0.18) inset" : "none",
        }}
      >
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "rgba(162,123,92,0.10)",
            border: `1px solid ${C.border}`,
          }}
        >
          <img
            src={providerLogoMap[provider]}
            className="h-12 w-12 rounded-md object-contain"
            alt={`${providerLabelMap[provider]} logo`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-xl font-bold" style={{ color: C.cream }}>
              {providerLabelMap[provider]}
            </h4>
            {getBadge(provider)}
          </div>

          <div
            className="flex flex-col gap-2 text-sm md:flex-row md:flex-wrap md:items-center md:gap-4"
            style={{ color: C.mutedStrong }}
          >
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
            className="rounded-xl px-3 py-2"
            style={{
              background: isBest ? "rgba(162,123,92,0.14)" : "rgba(63,79,68,0.25)",
              border: `1px solid ${C.border}`,
            }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-tight"
              style={{ color: isBest ? C.rose : C.muted }}
            >
              Estimated Impact
            </p>
            <p
              className="text-sm font-bold"
              style={{ color: isBest ? C.rose : C.cream }}
            >
              {providerImpactMap[provider]}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans antialiased" style={{ background: C.bg, color: C.cream }}>
      <div className="flex h-screen overflow-hidden">
        <Navbar />

        <main className="flex-1 overflow-y-auto" style={{ background: C.bg }}>
          <header
            className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8"
            style={{
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(44,57,48,0.82)",
            }}
          >
            <div className="flex items-center gap-2">
              <Route className="h-5 w-5" style={{ color: C.rose }} />
              <h2 className="text-xl font-bold tracking-tight" style={{ color: C.cream }}>
                Transfer Routes
              </h2>
            </div>

            <div className="flex gap-3">
              <button
                className="rounded-xl p-2"
                style={{
                  border: `1px solid ${C.border}`,
                  color: C.muted,
                  background: "transparent",
                }}
              >
                <Bell className="h-5 w-5" />
              </button>
              <button
                className="rounded-xl p-2"
                style={{
                  border: `1px solid ${C.border}`,
                  color: C.muted,
                  background: "transparent",
                }}
              >
                <HelpCircle className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h3 className="text-3xl font-black tracking-tight" style={{ color: C.cream }}>
                Route Optimization Analysis
              </h3>
              <p className="mt-2 text-lg" style={{ color: C.muted }}>
                Comparative breakdown of how current exchange routes affect your
                pending international student payments.
              </p>
            </div>

            <div
              className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl p-4 shadow-sm sm:gap-6"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: C.muted }}
                >
                  Sending From
                </span>
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{
                    background: C.surfaceStrong,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <ScrollText className="h-4 w-4" style={{ color: C.rose }} />
                  <span className="font-bold" style={{ color: C.cream }}>
                    USD
                  </span>
                </div>
              </div>

              <ArrowRight className="h-5 w-5" style={{ color: C.muted }} />

              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: C.muted }}
                >
                  Receiving In
                </span>
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{
                    background: C.surfaceStrong,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <ScrollText className="h-4 w-4" style={{ color: C.rose }} />
                  <span className="font-bold" style={{ color: C.cream }}>
                    BRL
                  </span>
                </div>
              </div>

              <div className="w-full sm:ml-auto sm:w-auto">
                <span className="text-xs" style={{ color: C.muted }}>
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

            <section
              className="mt-12 border-t pt-12 pb-8"
              style={{ borderColor: C.border }}
            >
              <h3 className="text-2xl font-bold" style={{ color: C.cream }}>
                Compare Providers
              </h3>
              <p className="mt-1 text-sm" style={{ color: C.muted }}>
                Calculate the impact on one of your actual bills using current
                provider quotes.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <label
                    className="block text-xs font-bold uppercase tracking-wider"
                    style={{ color: C.muted }}
                  >
                    Select Bill
                  </label>
                  <select
                    value={selectedBillId ?? ""}
                    onChange={(e) => setSelectedBillId(Number(e.target.value))}
                    disabled={loadingBills || bills.length === 0}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none disabled:opacity-60"
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      color: C.cream,
                    }}
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
                  <label
                    className="block text-xs font-bold uppercase tracking-wider"
                    style={{ color: C.muted }}
                  >
                    Left Provider
                  </label>
                  <select
                    value={leftProvider}
                    onChange={(e) => setLeftProvider(e.target.value as ProviderKey)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      color: C.cream,
                    }}
                  >
                    <option value="crebit">Crebit</option>
                    <option value="wise">Wise</option>
                    <option value="remitly">Remitly</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    className="block text-xs font-bold uppercase tracking-wider"
                    style={{ color: C.muted }}
                  >
                    Right Provider
                  </label>
                  <select
                    value={rightProvider}
                    onChange={(e) => setRightProvider(e.target.value as ProviderKey)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      color: C.cream,
                    }}
                  >
                    <option value="crebit">Crebit</option>
                    <option value="wise">Wise</option>
                    <option value="remitly">Remitly</option>
                  </select>
                </div>
              </div>

              <div
                className="mt-6 overflow-hidden rounded-2xl shadow-sm"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left">
                    <thead>
                      <tr style={{ background: "rgba(63,79,68,0.25)" }}>
                        <th
                          className="w-[34%] px-5 py-4 text-xs font-bold uppercase tracking-widest"
                          style={{ color: C.muted }}
                        >
                          Metric{" "}
                          {selectedBill
                            ? `(for $${selectedBill.amount.toLocaleString()} ${selectedBill.currency})`
                            : ""}
                        </th>

                        <th
                          className="w-[33%] px-5 py-4 text-sm font-bold"
                          style={{
                            color: C.cream,
                            background:
                              comparison?.winner === leftProvider
                                ? "rgba(162,123,92,0.12)"
                                : "transparent",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span>{providerLabelMap[leftProvider]}</span>
                            {comparison?.winner === leftProvider && (
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter"
                                style={{
                                  background: "rgba(52,211,153,0.15)",
                                  color: C.success,
                                }}
                              >
                                Winner
                              </span>
                            )}
                          </div>
                        </th>

                        <th
                          className="w-[33%] px-5 py-4 text-sm font-bold"
                          style={{
                            color: C.cream,
                            background:
                              comparison?.winner === rightProvider
                                ? "rgba(162,123,92,0.12)"
                                : "transparent",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span>{providerLabelMap[rightProvider]}</span>
                            {comparison?.winner === rightProvider && (
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter"
                                style={{
                                  background: "rgba(52,211,153,0.15)",
                                  color: C.success,
                                }}
                              >
                                Winner
                              </span>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {[
                        {
                          label: "Bill Name",
                          left: selectedBill?.name ?? "--",
                          right: selectedBill?.name ?? "--",
                        },
                        {
                          label: "Exchange Rate",
                          left: formatRate(rates[leftProvider]),
                          right: formatRate(rates[rightProvider]),
                        },
                        {
                          label: "Processing Fee",
                          left: comparison ? `$${comparison.leftFee.toFixed(2)} USD` : "--",
                          right: comparison ? `$${comparison.rightFee.toFixed(2)} USD` : "--",
                        },
                        {
                          label: "Total in BRL",
                          left: comparison ? formatBrl(comparison.leftTotalBrl) : "--",
                          right: comparison ? formatBrl(comparison.rightTotalBrl) : "--",
                          emphasize: true,
                        },
                        {
                          label: "Estimated Arrival (ETA)",
                          left: providerEtaMap[leftProvider],
                          right: providerEtaMap[rightProvider],
                        },
                        {
                          label: "Due Date",
                          left: selectedBill?.due_date ?? "--",
                          right: selectedBill?.due_date ?? "--",
                        },
                      ].map((row) => (
                        <tr
                          key={row.label}
                          style={{ borderTop: `1px solid ${C.border}` }}
                          className="transition-colors"
                        >
                          <td
                            className="px-5 py-4 text-sm font-medium"
                            style={{ color: C.cream }}
                          >
                            {row.label}
                          </td>

                          <td
                            className={`px-5 py-4 text-sm ${row.emphasize ? "text-base font-extrabold" : ""}`}
                            style={{
                              color:
                                row.emphasize && comparison?.winner === leftProvider
                                  ? C.rose
                                  : C.cream,
                              background:
                                comparison?.winner === leftProvider
                                  ? "rgba(162,123,92,0.08)"
                                  : "transparent",
                            }}
                          >
                            {row.left}
                          </td>

                          <td
                            className={`px-5 py-4 text-sm ${row.emphasize ? "text-base font-extrabold" : ""}`}
                            style={{
                              color:
                                row.emphasize && comparison?.winner === rightProvider
                                  ? C.rose
                                  : C.cream,
                              background:
                                comparison?.winner === rightProvider
                                  ? "rgba(162,123,92,0.08)"
                                  : "transparent",
                            }}
                          >
                            {row.right}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot style={{ borderTop: `1px solid ${C.border}`, background: "rgba(162,123,92,0.08)" }}>
                      <tr>
                        <td
                          className="px-5 py-5 text-sm font-bold italic"
                          style={{ color: C.cream }}
                        >
                          Total Savings on This Bill
                        </td>
                        <td className="px-5 py-5" colSpan={2}>
                          <div className="flex flex-col">
                            <span
                              className="text-xl font-black"
                              style={{ color: C.rose }}
                            >
                              {comparison ? formatBrl(comparison.savings) : "--"}
                            </span>
                            <span
                              className="text-[10px] font-bold uppercase tracking-tighter"
                              style={{ color: C.muted }}
                            >
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

            <div
              className="mt-12 flex items-start gap-6 rounded-2xl p-6"
              style={{
                border: `1px solid ${C.border}`,
                background: "rgba(162,123,92,0.08)",
              }}
            >
              <div
                className="rounded-full p-3"
                style={{ background: "rgba(162,123,92,0.12)", color: C.rose }}
              >
                <Info className="h-5 w-5" />
              </div>

              <div>
                <h5 className="mb-1 font-bold" style={{ color: C.rose }}>
                  How routes are calculated
                </h5>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: C.mutedStrong }}
                >
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