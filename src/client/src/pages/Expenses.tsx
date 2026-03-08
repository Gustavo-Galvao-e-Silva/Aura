import { Banknote, CirclePlus, ClockFading, TriangleAlert } from "lucide-react";
import Navbar from "../components/Navbar";
import ExpenseComponent from "../components/ExpenseComponent";
import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import AddExpensesModal from "../components/AddExpensesModal";
import apiClient from "../API/client";
import { getExpenseStats } from "../API/ExpensesClient";
import { useUser } from "@clerk/react-router";

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

type ExpenseFilter = "all" | "upcoming" | "paid" | "overdue" | "predicted";

export default function ExpensesPage() {
  const [showModal, setModalShow] = useState(false);
  const [expenses, setExpenses] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<ExpenseFilter>("all");
  const [stats, setStats] = useState({
    total_to_be_paid: 0,
    upcoming_total: 0,
    overdue_total: 0,
  });
  const { isLoaded, isSignedIn, user } = useUser();

useEffect(() => {
  if (!user?.username) return;

  async function loadPageData() {
    try {
      setLoading(true);

      const [expensesResponse, statsResponse] = await Promise.all([
        apiClient.get("/get-user-expenses", {
          params: {
            username: user?.username,
            filter_by: selectedFilter,
          },
        }),
        getExpenseStats(user!.username!),
      ]);

      setExpenses(expensesResponse.data["user-expenses"] ?? []);
      setStats(statsResponse);
    } catch (error) {
      console.error("Failed to fetch expenses:", error);
    } finally {
      setLoading(false);
    }
  }

  loadPageData();
}, [selectedFilter, user?.username]);

  function getTabClass(filter: ExpenseFilter) {
    const isActive = selectedFilter === filter;

    return isActive
      ? "border-b-2 border-blue-700 px-4 py-3 text-sm font-bold text-blue-700 sm:px-6"
      : "border-b-2 border-transparent px-4 py-3 text-sm font-bold text-slate-400 transition-colors hover:text-slate-600 sm:px-6";
  }

  function formatBRL(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  return (
    <div className="bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen overflow-hidden">
        <Navbar />

        <Modal isOpen={showModal} onClose={() => setModalShow(false)}>
          <AddExpensesModal CloseModal={() => setModalShow(false)} />
        </Modal>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <header className="flex flex-col justify-between gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:px-8">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Expenses Management
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 sm:text-base">
                Track and convert your international student costs
              </p>
            </div>

            <button
              onClick={() => setModalShow(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-700/25 transition-all hover:opacity-90 active:scale-95 sm:w-auto sm:py-2.5"
            >
              <CirclePlus className="h-5 w-5" />
              Add New Expense
            </button>
          </header>

          <div className="grid grid-cols-1 gap-4 px-4 py-2 sm:px-6 md:grid-cols-3 lg:px-8">
            <div className="rounded-2xl border border-blue-700/5 bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-blue-700/10 p-2 text-blue-700">
                  <Banknote className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold tracking-wide text-slate-400 sm:text-xs">
                  TOTAL TO BE PAID
                </span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                {formatBRL(stats.total_to_be_paid)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Unpaid non-predicted expenses
              </p>
            </div>

            <div className="rounded-2xl border border-blue-700/5 bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-yellow-100 p-2 text-yellow-600">
                  <ClockFading className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold tracking-wide text-slate-400 sm:text-xs">
                  UPCOMING
                </span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                {formatBRL(stats.upcoming_total)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Due within this week</p>
            </div>

            <div className="rounded-2xl border border-blue-700/5 bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-red-100 p-2 text-red-600">
                  <TriangleAlert className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold tracking-wide text-slate-400 sm:text-xs">
                  OVERDUE
                </span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                {formatBRL(stats.overdue_total)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Immediate action required
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
                  All Expenses
                </button>
                <button
                  className={getTabClass("upcoming")}
                  onClick={() => setSelectedFilter("upcoming")}
                >
                  Upcoming
                </button>
                <button
                  className={getTabClass("paid")}
                  onClick={() => setSelectedFilter("paid")}
                >
                  Paid
                </button>
                <button
                  className={getTabClass("overdue")}
                  onClick={() => setSelectedFilter("overdue")}
                >
                  Overdue
                </button>
                <button
                  className={getTabClass("predicted")}
                  onClick={() => setSelectedFilter("predicted")}
                >
                  Predicted
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-blue-700/5 bg-white shadow-sm dark:bg-slate-900">
              {loading ? (
                <div className="px-6 py-10 text-center text-slate-500">
                  Loading expenses...
                </div>
              ) : expenses.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-500">
                  No expenses found.
                </div>
              ) : (
                <>
                  <div className="space-y-4 p-4 md:hidden">
                    {expenses.map((expense) => (
                      <ExpenseComponent
                        key={expense.id}
                        Name={expense.name}
                        Date={expense.due_date}
                        Value={expense.amount}
                        Currency={expense.currency}
                        Status={
                          expense.is_paid
                            ? "Paid"
                            : new Date(expense.due_date) < new Date()
                            ? "Overdue"
                            : "Upcoming"
                        }
                        Category={expense.category ?? "Other"}
                      />
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-left">
                      <thead>
                        <tr className="border-b border-blue-700/10 bg-slate-50 dark:bg-slate-800/50">
                          <th className="w-[30%] px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                            Expense Name
                          </th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                            Due Date
                          </th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                            Original Amount
                          </th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-blue-700">
                            BRL Conversion
                          </th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                            Status
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-blue-700/5">
                        {expenses.map((expense) => (
                          <ExpenseComponent
                            key={expense.id}
                            Name={expense.name}
                            Date={expense.due_date}
                            Value={expense.amount}
                            Currency={expense.currency}
                            Status={
                              expense.is_paid
                                ? "Paid"
                                : new Date(expense.due_date) < new Date()
                                ? "Overdue"
                                : "Upcoming"
                            }
                            Category={expense.category ?? "Other"}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="px-4 pb-6 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-blue-700/20 bg-blue-700/5 p-4 md:flex-row md:items-center">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 text-blue-700">
                  currency_exchange
                </span>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Rates updated 5 minutes ago:{" "}
                  <span className="font-bold">1 USD = 5.12 BRL</span> |{" "}
                  <span className="font-bold">1 EUR = 5.44 BRL</span>
                </p>
              </div>
              <button className="text-xs font-bold text-blue-700 hover:underline">
                Manage Currency Settings
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}