import { Banknote, CirclePlus, ClockFading, TriangleAlert, Wallet } from "lucide-react";
import Navbar from "../components/Navbar";
import ExpenseComponent from "../components/ExpenseComponent";
import { useState } from "react";
import Modal from "../components/Modal";
import AddExpensesModal from "../components/AddExpensesModal";



  const fakeExpenses = [
    {
      Name: "Tuition Fees - Semester 2",
      Date: "Oct 15, 2023",
      Value: 2000,
      Currency: "$",
      Status: "Upcoming",
    },
    {
      Name: "Monthly Rent",
      Date: "Oct 01, 2023",
      Value: 800,
      Currency: "€",
      Status: "Paid",
    },
    {
      Name: "Weekly Groceries",
      Date: "Sep 28, 2023",
      Value: 150,
      Currency: "$",
      Status: "Paid",
    },
    {
      Name: "Health Insurance",
      Date: "Sep 20, 2023",
      Value: 120,
      Currency: "€",
      Status: "Overdue",
    },
    {
      Name: "Transport Pass",
      Date: "Oct 20, 2023",
      Value: 45,
      Currency: "€",
      Status: "Upcoming",
    },
];

export default function ExpensesPage() {
    const [ShowModal, setModalShow] = useState<boolean>(false)

  return (

    <div className="bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <div className="flex h-screen overflow-hidden">
       <Navbar/>


        <Modal isOpen={ShowModal} onClose={() => setModalShow(false)} children={<AddExpensesModal CloseModal={() => setModalShow(false)}/>}/>
        <main className="flex flex-1 flex-col overflow-y-auto">
          <header className="flex flex-col justify-between gap-4 p-8 pb-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Expenses Management
              </h2>
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                Track and convert your international student costs
              </p>
            </div>

            <button onClick={() => {setModalShow(true)}} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-700/25 transition-all hover:opacity-90 active:scale-95">
              <span className="material-symbols-outlined text-xl">
                <CirclePlus/>
              </span>
              Add New Expense
            </button>
          </header>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 gap-6 px-8 py-4 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-700/5 bg-white p-6 shadow-sm dark:bg-slate-900">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-blue-700/10 p-2 text-blue-700">
                  <span className="material-symbols-outlined"> <Banknote/> </span>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  TOTAL TO BE PAID
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                R$ 15.362,80
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Calculated from USD/EUR
              </p>
            </div>

            <div className="rounded-2xl border border-blue-700/5 bg-white p-6 shadow-sm dark:bg-slate-900">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-yellow-100 p-2 text-yellow-600">
                  <span className="material-symbols-outlined"> <ClockFading/> </span>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  UPCOMING
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                R$ 10.240,00
              </p>
              <p className="mt-1 text-xs text-slate-500">Due within 30 days</p>
            </div>

            <div className="rounded-2xl border border-blue-700/5 bg-white p-6 shadow-sm dark:bg-slate-900">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-red-100 p-2 text-red-600">
                  <span className="material-symbols-outlined"> <TriangleAlert/> </span>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  OVERDUE
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                R$ 652,80
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Immediate action required
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 px-8">
            <div className="flex border-b border-blue-700/10">
              <button className="border-b-2 border-blue-700 px-6 py-3 text-sm font-bold text-blue-700">
                All Expenses
              </button>
              <button className="border-b-2 border-transparent px-6 py-3 text-sm font-bold text-slate-400 transition-colors hover:text-slate-600">
                Upcoming
              </button>
              <button className="border-b-2 border-transparent px-6 py-3 text-sm font-bold text-slate-400 transition-colors hover:text-slate-600">
                Paid
              </button>
              <button className="border-b-2 border-transparent px-6 py-3 text-sm font-bold text-slate-400 transition-colors hover:text-slate-600">
                Overdue
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 px-8 py-6">
            <div className="@container overflow-hidden rounded-2xl border border-blue-700/5 bg-white shadow-sm dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
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
                    
                        <ExpenseComponent Name={"as"} Date={"as"} Value={100} Currency={"as"} Status={"as"}/>
                        <ExpenseComponent Name={"as"} Date={"as"} Value={100} Currency={"as"} Status={"as"}/>
                        <ExpenseComponent Name={"as"} Date={"as"} Value={100} Currency={"as"} Status={"as"}/>
                        <ExpenseComponent Name={"as"} Date={"as"} Value={100} Currency={"as"} Status={"as"}/>
                        <ExpenseComponent Name={"as"} Date={"as"} Value={100} Currency={"as"} Status={"as"}/>
                   
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Conversion Footer */}
          <div className="px-8 pb-8">
            <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-blue-700/20 bg-blue-700/5 p-4 md:flex-row">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-700">
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

        {/* Hidden Modal Placeholder */}
        <div className="fixed inset-0 z-50 hidden items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold">New Expense</h3>
              <button className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Expense Name
                </label>
                <input
                  className="w-full rounded-lg border border-blue-700/20 focus:border-blue-700 focus:ring-blue-700"
                  placeholder="e.g. Monthly Rent"
                  type="text"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">
                    Amount
                  </label>
                  <input
                    className="w-full rounded-lg border border-blue-700/20 focus:border-blue-700 focus:ring-blue-700"
                    placeholder="0.00"
                    type="number"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">
                    Currency
                  </label>
                  <select className="w-full rounded-lg border border-blue-700/20 focus:border-blue-700 focus:ring-blue-700">
                    <option>USD ($)</option>
                    <option>EUR (€)</option>
                    <option>GBP (£)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Due Date
                </label>
                <input
                  className="w-full rounded-lg border border-blue-700/20 focus:border-blue-700 focus:ring-blue-700"
                  type="date"
                />
              </div>

              <button
                className="mt-2 w-full rounded-xl bg-blue-700 py-3 font-bold text-white shadow-lg shadow-blue-700/30"
                type="button"
              >
                Save Expense
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


