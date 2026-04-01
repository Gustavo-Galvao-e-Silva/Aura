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
  Wallet,
  History,
} from "lucide-react";
import Navbar from "../components/Navbar";
import {
  getBalance,
  getTransactionHistory,
  createCheckoutSession,
} from "../API/PaymentsClient";
import type { WalletBalance, TransactionItem } from "../API/PaymentsClient";

const PRESET_AMOUNTS = [25, 50, 100, 250, 500];

// ─── shared palette ───────────────────────────────────────────────────────────
const C = {
  bg: "#2C3930",
  surface: "rgba(63,79,68,0.18)",
  border: "rgba(162,123,92,0.1)",
  rose: "#A27B5C",
  cream: "#DCD7C9",
  muted: "rgba(220,215,201,0.5)",
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TxIcon({ direction }: { direction: string }) {
  if (direction === "credit") {
    return <ArrowDownLeft size={16} style={{ color: "#34d399" }} />;
  }
  return <ArrowUpRight size={16} style={{ color: "#f87171" }} />;
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

// ─── page ─────────────────────────────────────────────────────────────────────
export default function WalletPage() {
  const { user, isLoaded } = useUser();
  const [searchParams] = useSearchParams();
  const depositStatus = searchParams.get("deposit");

  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [history, setHistory] = useState<TransactionItem[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState("50");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const username = user?.username ?? null;

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
    <div className="flex h-screen overflow-hidden font-sans antialiased" style={{ background: C.bg }}>
      <Navbar />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-8 p-8">
          {/* Header */}
          <header
            className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
            style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: "1.5rem" }}
          >
            <div>
              <h1 className="text-2xl font-black" style={{ color: C.cream }}>
                Wallet
              </h1>
              <p className="mt-1 text-sm" style={{ color: C.muted }}>
                Manage your funds and make deposits via Stripe
              </p>
            </div>
          </header>

          {/* Deposit status banners */}
          {depositStatus === "success" && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{
                background: "rgba(52,211,153,0.12)",
                border: "1px solid rgba(52,211,153,0.22)",
                color: "#86efac",
              }}
            >
              <CheckCircle size={20} />
              <span className="font-medium">
                Deposit successful! Your balance will update once Stripe confirms the payment.
              </span>
            </div>
          )}

          {depositStatus === "cancelled" && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.22)",
                color: "#fca5a5",
              }}
            >
              <XCircle size={20} />
              <span className="font-medium">Deposit cancelled. No charge was made.</span>
            </div>
          )}

          {/* Balance cards */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div
              className="rounded-2xl p-6"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <div className="mb-4 flex items-start justify-between">
                <div
                  className="rounded-xl p-2"
                  style={{ background: "rgba(162,123,92,0.12)", color: C.rose }}
                >
                  <Wallet size={20} />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: C.muted }}
                >
                  Available Balance
                </span>
              </div>

              {balanceLoading ? (
                <div
                  className="h-8 w-28 animate-pulse rounded-md"
                  style={{ background: "rgba(220,215,201,0.08)" }}
                />
              ) : (
                <>
                  <p className="text-3xl font-black" style={{ color: C.cream }}>
                    ${balance?.usd_available.toFixed(2) ?? "0.00"}
                  </p>

                  {(balance?.brl_pending ?? 0) > 0 && (
                    <p
                      className="mt-2 flex items-center gap-1 text-xs"
                      style={{ color: "#fbbf24" }}
                    >
                      <Clock size={12} />
                      ${balance!.brl_pending.toFixed(2)} pending
                    </p>
                  )}
                </>
              )}
            </div>

            <div
              className="rounded-2xl p-6"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <div className="mb-4 flex items-start justify-between">
                <div
                  className="rounded-xl p-2"
                  style={{ background: "rgba(162,123,92,0.12)", color: C.rose }}
                >
                  <TrendingUp size={20} />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: C.muted }}
                >
                  Lifetime Stats
                </span>
              </div>

              {balanceLoading ? (
                <div
                  className="h-8 w-28 animate-pulse rounded-md"
                  style={{ background: "rgba(220,215,201,0.08)" }}
                />
              ) : (
                <div className="space-y-2">
                  <p className="text-sm" style={{ color: C.muted }}>
                    Total deposited{" "}
                    <span className="font-semibold" style={{ color: C.cream }}>
                      ${balance?.total_deposited_brl.toFixed(2) ?? "0.00"}
                    </span>
                  </p>
                  <p className="text-sm" style={{ color: C.muted }}>
                    Total spent{" "}
                    <span className="font-semibold" style={{ color: C.cream }}>
                      ${balance?.total_spent_brl.toFixed(2) ?? "0.00"}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Deposit form */}
          <div
            className="rounded-2xl p-6"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <div className="mb-6 flex items-center gap-3">
              <div
                className="rounded-xl p-2"
                style={{ background: "rgba(162,123,92,0.12)", color: C.rose }}
              >
                <CreditCard size={20} />
              </div>
              <div>
                <h2 className="font-semibold" style={{ color: C.cream }}>
                  Make a Deposit
                </h2>
                <p className="text-xs" style={{ color: C.muted }}>
                  Powered by Stripe — test mode
                </p>
              </div>
            </div>

            {/* Preset buttons */}
            <div className="mb-4 flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((p) => {
                const active = depositAmount === String(p);

                return (
                  <button
                    key={p}
                    onClick={() => {
                      setDepositAmount(String(p));
                      setError(null);
                    }}
                    className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                    style={{
                      background: active ? "rgba(162,123,92,0.16)" : "rgba(220,215,201,0.04)",
                      border: `1px solid ${active ? "rgba(162,123,92,0.35)" : C.border}`,
                      color: active ? C.rose : C.cream,
                    }}
                  >
                    ${p}
                  </button>
                );
              })}
            </div>

            {/* Custom amount */}
            <div className="mb-5">
              <label
                className="mb-1.5 block text-sm font-medium"
                style={{ color: C.cream }}
              >
                Custom amount (USD)
              </label>

              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 font-medium"
                  style={{ color: C.muted }}
                >
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
                  className="w-full rounded-xl bg-transparent py-2.5 pl-7 pr-4 outline-none"
                  style={{
                    border: `1px solid ${C.border}`,
                    color: C.cream,
                    caretColor: C.rose,
                  }}
                  placeholder="50.00"
                />
              </div>
            </div>

            {error && (
              <p className="mb-4 text-sm" style={{ color: "#fca5a5" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleDeposit}
              disabled={!isValidAmount || checkoutLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: C.rose, color: C.bg }}
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

            <p className="mt-3 text-center text-xs" style={{ color: C.muted }}>
              Secured by Stripe. Card details never touch our servers.
            </p>
          </div>

          {/* Transaction history */}
          <div
            className="rounded-2xl"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <div className="flex items-center gap-2">
                <History size={18} style={{ color: C.rose }} />
                <h2 className="font-semibold" style={{ color: C.cream }}>
                  Transaction History
                </h2>
              </div>
              <span className="text-xs" style={{ color: C.muted }}>
                {history.length} entries
              </span>
            </div>

            {historyLoading ? (
              <div className="space-y-3 p-6">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-lg"
                    style={{ background: "rgba(220,215,201,0.06)" }}
                  />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: C.muted }}>
                No transactions yet. Make your first deposit above.
              </div>
            ) : (
              <ul>
                {history.map((tx, index) => (
                  <li
                    key={tx.id}
                    className="flex items-center gap-4 px-6 py-4"
                    style={{
                      borderTop: index === 0 ? "none" : `1px solid ${C.border}`,
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "rgba(220,215,201,0.06)" }}
                    >
                      <TxIcon direction={tx.direction} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-semibold"
                        style={{ color: C.cream }}
                      >
                        {tx.description}
                      </p>
                      <p className="text-xs" style={{ color: C.muted }}>
                        {txTypeLabel(tx.transaction_type)} · {fmtDate(tx.created_at)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className="text-sm font-bold"
                        style={{
                          color: tx.direction === "credit" ? "#34d399" : "#f87171",
                        }}
                      >
                        {tx.direction === "credit" ? "+" : "−"}${tx.amount.toFixed(2)}
                      </p>
                      {tx.balance_after != null && (
                        <p className="text-xs" style={{ color: C.muted }}>
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