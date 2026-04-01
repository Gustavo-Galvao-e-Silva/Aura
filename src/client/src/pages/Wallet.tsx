import { useEffect, useState } from "react";
import { useUser } from "@clerk/react-router";
import { useSearchParams } from "react-router";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  CheckCircle,
  XCircle,
  Loader,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import Navbar from "../components/Navbar";
import {
  getBalance,
  getTransactionHistory,
  createCheckoutSession,
} from "../API/PaymentsClient";
import type { WalletBalance, TransactionItem } from "../API/PaymentsClient";

const PRESET_AMOUNTS = [25, 50, 100, 250, 500];

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TxIcon({ direction }: { direction: string }) {
  if (direction === "credit")
    return <ArrowDownLeft size={16} className="text-emerald-500" />;
  return <ArrowUpRight size={16} className="text-red-400" />;
}

function txTypeLabel(type: string) {
  const map: Record<string, string> = {
    deposit: "Deposit",
    payment: "Payment",
    refund: "Refund",
    conversion: "Conversion",
  };
  return map[type] ?? type;
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { user, isLoaded } = useUser();
  const [searchParams] = useSearchParams();
  const depositStatus = searchParams.get("deposit"); // "success" | "cancelled"

  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [history, setHistory] = useState<TransactionItem[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState("50");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const username = user?.username ?? null;

  // Load balance + history in parallel
  useEffect(() => {
    if (!isLoaded || !username) return;

    setBalanceLoading(true);
    setHistoryLoading(true);

    getBalance(username)
      .then(setBalance)
      .catch(() => setError("Failed to load balance."))
      .finally(() => setBalanceLoading(false));

    getTransactionHistory(username, 20)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [isLoaded, username]);

  async function handleDeposit() {
    if (!username) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 1) {
      setError("Minimum deposit is $1.00");
      return;
    }
    try {
      setCheckoutLoading(true);
      setError(null);
      const { checkout_url } = await createCheckoutSession(username, amount);
      window.location.href = checkout_url;
    } catch {
      setError("Failed to start checkout. Please try again.");
      setCheckoutLoading(false);
    }
  }

  const parsedAmount = parseFloat(depositAmount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount >= 1;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Wallet</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage your funds and make deposits via Stripe
            </p>
          </div>

          {/* Deposit status banners */}
          {depositStatus === "success" && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle size={20} />
              <span className="font-medium">
                Deposit successful! Your balance will update once Stripe confirms the payment.
              </span>
            </div>
          )}
          {depositStatus === "cancelled" && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
              <XCircle size={20} />
              <span className="font-medium">Deposit cancelled. No charge was made.</span>
            </div>
          )}

          {/* Balance cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* USD available */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900">
                  <DollarSign size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Available Balance
                </span>
              </div>
              {balanceLoading ? (
                <div className="h-8 w-24 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
              ) : (
                <>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    ${balance?.usd_available.toFixed(2) ?? "0.00"}
                  </p>
                  {(balance?.brl_pending ?? 0) > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Clock size={12} />
                      ${balance!.brl_pending.toFixed(2)} pending
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Totals */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
                  <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Lifetime Stats
                </span>
              </div>
              {balanceLoading ? (
                <div className="h-8 w-24 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Total deposited{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      ${balance?.total_deposited_brl.toFixed(2) ?? "0.00"}
                    </span>
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Total spent{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      ${balance?.total_spent_brl.toFixed(2) ?? "0.00"}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Deposit form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900">
                <CreditCard size={20} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Make a Deposit</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Powered by Stripe — test mode
                </p>
              </div>
            </div>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESET_AMOUNTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setDepositAmount(String(p))}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    depositAmount === String(p)
                      ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  ${p}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Custom amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => {
                    setDepositAmount(e.target.value);
                    setError(null);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-7 pr-4 text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="50.00"
                />
              </div>
            </div>

            {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              onClick={handleDeposit}
              disabled={!isValidAmount || checkoutLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkoutLoading ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Redirecting to Stripe…
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  Deposit ${isValidAmount ? parsedAmount.toFixed(2) : "—"} via Stripe
                </>
              )}
            </button>

            <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-600">
              Secured by Stripe. Card details never touch our servers.
            </p>
          </div>

          {/* Transaction history */}
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">Transaction History</h2>
              <span className="text-xs text-slate-400">{history.length} entries</span>
            </div>

            {historyLoading ? (
              <div className="space-y-3 p-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-600">
                No transactions yet. Make your first deposit above.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((tx) => (
                  <li key={tx.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      <TxIcon direction={tx.direction} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {tx.description}
                      </p>
                      <p className="text-xs text-slate-400">
                        {txTypeLabel(tx.transaction_type)} · {fmtDate(tx.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${
                          tx.direction === "credit"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-500 dark:text-red-400"
                        }`}
                      >
                        {tx.direction === "credit" ? "+" : "−"}${tx.amount.toFixed(2)}
                      </p>
                      {tx.balance_after != null && (
                        <p className="text-xs text-slate-400">
                          bal ${tx.balance_after.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
