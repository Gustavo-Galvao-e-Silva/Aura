import { useEffect, useState } from "react";
import { useUser } from "@clerk/react-router";
import { useSearchParams } from "react-router";
import { DollarSign, TrendingUp, CreditCard, CheckCircle, XCircle, Loader } from "lucide-react";
import Navbar from "../components/Navbar";
import { getBalance, createCheckoutSession } from "../API/PaymentsClient";

type Balance = {
  usd_balance: number;
  brl_balance: number;
};

const PRESET_AMOUNTS = [25, 50, 100, 250, 500];

export default function WalletPage() {
  const { user, isLoaded } = useUser();
  const [searchParams] = useSearchParams();

  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState<string>("50");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depositStatus = searchParams.get("deposit"); // "success" | "cancelled"

  useEffect(() => {
    if (!isLoaded || !user?.username) return;

    async function loadBalance() {
      try {
        setBalanceLoading(true);
        const data = await getBalance(user!.username!);
        setBalance(data);
      } catch {
        setError("Failed to load balance.");
      } finally {
        setBalanceLoading(false);
      }
    }

    loadBalance();
  }, [isLoaded, user?.username]);

  async function handleDeposit() {
    if (!user?.username) return;

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 1) {
      setError("Minimum deposit is $1.00");
      return;
    }

    try {
      setCheckoutLoading(true);
      setError(null);
      const { checkout_url } = await createCheckoutSession(user.username, amount);
      window.location.href = checkout_url;
    } catch {
      setError("Failed to create checkout session. Please try again.");
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

          {/* Deposit status banner */}
          {depositStatus === "success" && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle size={20} />
              <span className="font-medium">Deposit successful! Your balance will reflect shortly.</span>
            </div>
          )}

          {depositStatus === "cancelled" && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
              <XCircle size={20} />
              <span className="font-medium">Deposit cancelled. No charge was made.</span>
            </div>
          )}

          {/* Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900">
                  <DollarSign size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">USD Balance</span>
              </div>
              {balanceLoading ? (
                <div className="h-8 w-24 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
              ) : (
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  ${balance?.usd_balance.toFixed(2) ?? "0.00"}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
                  <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">BRL Balance</span>
              </div>
              {balanceLoading ? (
                <div className="h-8 w-24 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
              ) : (
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  R${balance?.brl_balance.toFixed(2) ?? "0.00"}
                </p>
              )}
            </div>
          </div>

          {/* Deposit Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900">
                <CreditCard size={20} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Make a Deposit</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Powered by Stripe — test mode</p>
              </div>
            </div>

            {/* Preset amounts */}
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDepositAmount(String(preset))}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    depositAmount === String(preset)
                      ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>

            {/* Custom amount input */}
            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Custom amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
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

            {error && (
              <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

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

        </div>
      </main>
    </div>
  );
}
