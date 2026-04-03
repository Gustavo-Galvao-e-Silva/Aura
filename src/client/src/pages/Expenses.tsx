import { Banknote, CirclePlus, ClockFading, TriangleAlert } from "lucide-react";
import Navbar from "../components/Navbar";
import ExpenseComponent from "../components/ExpenseComponent";
import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import AddExpensesModal from "../components/AddExpensesModal";
import apiClient from "../API/client";
import { getExpenseStats, updateExpense, deleteExpense } from "../API/ExpensesClient";
import { useUser } from "@clerk/react-router";

// ─── palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      "#2C3930",
  surface: "rgba(63,79,68,0.18)",
  border:  "rgba(162,123,92,0.1)",
  rose:    "#A27B5C",
  cream:   "#DCD7C9",
  muted:   "rgba(220,215,201,0.5)",
};

type Liability = {
  id: number;
  username: string;
  name: string;
  amount: number;
  currency: "USD" | "BRL";
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

  const { user } = useUser();

  useEffect(() => {
    if (!user?.username) return;

    async function loadPageData() {
      try {
        setLoading(true);

        const [expensesResponse, statsResponse] = await Promise.all([
          apiClient.get(`/expenses/user/${user?.username}`, {
            params: { filter_by: selectedFilter },
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

  async function handleExpenseSave(updated: {
    id: number;
    username: string;
    name: string;
    date: string;
    value: number;
    currency: "USD" | "BRL";
    status: string;
    category: string;
    is_paid: boolean;
  }) {
    try {
      await updateExpense(updated.id, {
        username: updated.username,
        name: updated.name,
        amount: updated.value,
        currency: updated.currency,
        due_date: updated.date,
        category: updated.category,
        is_paid: updated.is_paid,
      });

      setExpenses((prev) =>
        prev.map((expense) =>
          expense.id === updated.id
            ? {
                ...expense,
                username: updated.username,
                name: updated.name,
                due_date: updated.date,
                amount: updated.value,
                currency: updated.currency,
                category: updated.category,
                is_paid: updated.is_paid,
              }
            : expense
        )
      );

      if (user?.username) {
        const statsResponse = await getExpenseStats(user.username);
        setStats(statsResponse);
      }
    } catch (error) {
      console.error("Failed to update expense:", error);
    }
  }

  async function handleExpenseDelete(expenseId: number) {
    try {
      await deleteExpense(expenseId);

      setExpenses((prev) => prev.filter((expense) => expense.id !== expenseId));

      if (user?.username) {
        const statsResponse = await getExpenseStats(user.username);
        setStats(statsResponse);
      }
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  }

  function getTabClass(filter: ExpenseFilter) {
    const isActive = selectedFilter === filter;
    return isActive
      ? "border-b-2 px-4 py-3 text-sm font-bold sm:px-6"
      : "border-b-2 border-transparent px-4 py-3 text-sm font-bold transition-colors sm:px-6";
  }

  function getTabStyle(filter: ExpenseFilter): React.CSSProperties {
    const isActive = selectedFilter === filter;
    return isActive
      ? { borderColor: C.rose, color: C.rose }
      : { color: C.muted };
  }

  function formatBRL(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  function getStatus(expense: Liability) {
    if (expense.is_paid) return "Paid";
    if (new Date(expense.due_date) < new Date()) return "Overdue";
    return "Upcoming";
  }

  return (
    <div className="font-sans antialiased" style={{ background: C.bg, color: C.cream }}>
      <div className="flex min-h-screen overflow-hidden">
        <Navbar />

        <Modal isOpen={showModal} onClose={() => setModalShow(false)}>
          <AddExpensesModal CloseModal={() => setModalShow(false)} />
        </Modal>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <header
            className="flex flex-col justify-between gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:px-8"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.cream }}>
                Expenses Management
              </h2>
              <p className="mt-1 text-sm sm:text-base" style={{ color: C.muted }}>
                Track and convert your international student costs
              </p>
            </div>

            <button
              onClick={() => setModalShow(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all hover:opacity-90 active:scale-95 sm:w-auto sm:py-2.5"
              style={{ background: C.rose, color: C.bg }}
            >
              <CirclePlus className="h-5 w-5" />
              Add New Expense
            </button>
          </header>

          <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-6 md:grid-cols-3 lg:px-8">
            {/* Total to be paid */}
            <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg p-2" style={{ background: `${C.rose}18`, color: C.rose }}>
                  <Banknote className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold tracking-wide sm:text-xs" style={{ color: C.muted }}>
                  TOTAL TO BE PAID
                </span>
              </div>
              <p className="text-xl font-black sm:text-2xl" style={{ color: C.cream }}>
                {formatBRL(stats.total_to_be_paid)}
              </p>
              <p className="mt-1 text-xs" style={{ color: C.muted }}>
                Unpaid non-predicted expenses
              </p>
            </div>

            {/* Upcoming */}
            <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-yellow-100 p-2 text-yellow-600">
                  <ClockFading className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold tracking-wide sm:text-xs" style={{ color: C.muted }}>
                  UPCOMING
                </span>
              </div>
              <p className="text-xl font-black sm:text-2xl" style={{ color: C.cream }}>
                {formatBRL(stats.upcoming_total)}
              </p>
              <p className="mt-1 text-xs" style={{ color: C.muted }}>Due within this week</p>
            </div>

            {/* Overdue */}
            <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-red-100 p-2 text-red-600">
                  <TriangleAlert className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold tracking-wide sm:text-xs" style={{ color: C.muted }}>
                  OVERDUE
                </span>
              </div>
              <p className="text-xl font-black sm:text-2xl" style={{ color: C.cream }}>
                {formatBRL(stats.overdue_total)}
              </p>
              <p className="mt-1 text-xs" style={{ color: C.muted }}>
                Immediate action required
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-2 px-4 sm:px-6 lg:px-8">
            <div className="overflow-x-auto">
              <div className="flex min-w-max" style={{ borderBottom: `1px solid ${C.border}` }}>
                {(["all", "upcoming", "paid", "overdue", "predicted"] as ExpenseFilter[]).map((f) => (
                  <button
                    key={f}
                    className={getTabClass(f)}
                    style={getTabStyle(f)}
                    onClick={() => setSelectedFilter(f)}
                  >
                    {f === "all" ? "All Expenses" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-2xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              {loading ? (
                <div className="px-6 py-10 text-center" style={{ color: C.muted }}>
                  Loading expenses...
                </div>
              ) : expenses.length === 0 ? (
                <div className="px-6 py-10 text-center" style={{ color: C.muted }}>
                  No expenses found.
                </div>
              ) : (
                <>
                  <div className="space-y-4 p-4 md:hidden">
                    {expenses.map((expense) => (
                      <ExpenseComponent
                        key={expense.id}
                        id={expense.id}
                        username={expense.username}
                        Name={expense.name}
                        Date={expense.due_date}
                        Value={expense.amount}
                        Currency={expense.currency}
                        Status={getStatus(expense)}
                        Category={expense.category ?? "Other"}
                        IsPaid={expense.is_paid}
                        onSave={handleExpenseSave}
                        onDelete={handleExpenseDelete}
                      />
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-left">
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}`, background: "rgba(63,79,68,0.25)" }}>
                          <th className="w-[30%] px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                            Expense Name
                          </th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                            Due Date
                          </th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                            Original Amount
                          </th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.rose }}>
                            BRL Conversion
                          </th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                            Status
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody style={{ borderTop: `1px solid ${C.border}` }}>
                        {expenses.map((expense) => (
                          <ExpenseComponent
                            key={expense.id}
                            id={expense.id}
                            username={expense.username}
                            Name={expense.name}
                            Date={expense.due_date}
                            Value={expense.amount}
                            Currency={expense.currency}
                            Status={getStatus(expense)}
                            Category={expense.category ?? "Other"}
                            IsPaid={expense.is_paid}
                            onSave={handleExpenseSave}
                            onDelete={handleExpenseDelete}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
