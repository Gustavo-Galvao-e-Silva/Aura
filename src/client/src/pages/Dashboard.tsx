import { useUser } from "@clerk/react-router";
import { BellDot, Clock, ClockFading, Home, House, Route, School, ScrollText, Search, ShoppingCart, TrendingDownIcon, TrendingUp, Wallet } from "lucide-react";
import { useNavigate } from "react-router";

export default function Dashboard() {
    const { isLoaded, isSignedIn, user } = useUser();
    let navigate = useNavigate();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    navigate("/")
  }


  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex hidden">
          <div className="flex items-center gap-3 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white">
              <span className="material-symbols-outlined">
                <Wallet/>
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight">
                Thea.do
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Student Finance
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-4">
            <a
              className="flex items-center gap-3 rounded-lg bg-blue-700 px-3 py-2.5 text-white"
              href="#"
            >
              <span className="material-symbols-outlined"> <Home size={25}/> </span>
              <span className="text-sm font-medium">Home</span>
            </a>
            <a
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              href="#"
            >
              <span className="material-symbols-outlined"> <ScrollText/> </span>
              <span className="text-sm font-medium">Expenses</span>
            </a>
            <a
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              href="#"
            >
              <span className="material-symbols-outlined"> <ClockFading/> </span>
              <span className="text-sm font-medium"> Bill Scheduler </span>
            </a>
            <a
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              href="#"
            >
              <span className="material-symbols-outlined"> <Route/> </span>
              <span className="text-sm font-medium"> FX Routes</span>
            </a>

          </nav>

          <div className="mt-auto p-4">
            <div className="rounded-xl bg-blue-700/10 p-4 dark:bg-blue-700/20">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                Scholarship Status
              </p>
              <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">
                Next disbursement in 12 days.
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full w-3/4 bg-blue-700" />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-8 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">Dashboard Overview</h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl text-slate-400">
                  <Search size={20}/>
                </span>
                <input
                  className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-700 focus:ring-blue-700 dark:border-slate-800 dark:bg-slate-900"
                  placeholder="Search transactions..."
                  type="text"
                />
              </div>

              <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <span className="material-symbols-outlined"> <BellDot size={20}/> </span>
              </button>

              <div className="flex items-center gap-3 border-l border-slate-200 pl-2 dark:border-slate-800">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold"> {user?.firstName + " " +  user?.lastName}</p>
                </div>
                <img
                  className="h-10 w-10 rounded-full border-2 border-blue-700/20 object-cover"
                  alt="Student profile"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBEDGX3HS3gbChtull0TBQKmhvdKHZC3M49geRWbhHR76xQHaWj6GJvuIoBDBeK8JZRZDcrcY5k4C-I34n7iv4J1Kzk8b-z8qXKhuVyvjyQiqAfC8f1rd7waG1fzP-1B9gCu6Rm00O_-OvporXnPsEU2vfdUDuhW18sGuRxxOR8rHMxBaEobV-QwvOI2Sp_tUdXw7Pua1lIi92wOdSyoFSw3RqtXNxrbVxPqmo7WRmNhXcv1Lw7lV9Z4-aAVXG7ForG1wZXW3cu6pvH"
                />
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-8 p-8">
            {/* Summary Section */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="absolute right-0 top-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-blue-700/5 transition-transform group-hover:scale-110" />
                <p className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Available Balance
                </p>
                <h3 className="text-3xl font-bold tracking-tight">$4,250.00</h3>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-500">
                  <span className="material-symbols-outlined text-base">
                    <TrendingUp/>
                  </span>
                  <span>+12.5% from last month</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Next Payment Due
                </p>
                <h3 className="text-3xl font-bold tracking-tight">
                  Oct 15, 2023
                </h3>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-500">
                  <span className="material-symbols-outlined text-base">
                    <Clock/>
                  </span>
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
              {/* Upcoming Expenses */}
              <div className="flex flex-col gap-4 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold">Upcoming Expenses</h4>
                  <a className="text-sm font-semibold text-blue-700 hover:underline" href="#">
                    View All
                  </a>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <span className="material-symbols-outlined"> <School/> </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Tuition Fees</p>
                      <p className="text-xs text-slate-500">Due Oct 15, 2023</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">$2,500.00</p>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">
                        Quarterly
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                      <span className="material-symbols-outlined">
                        <House/>
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Monthly Rent</p>
                      <p className="text-xs text-slate-500">Due Oct 01, 2023</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">$1,200.00</p>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] text-amber-600 dark:bg-amber-900/30">
                        Upcoming
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                      <span className="material-symbols-outlined">
                        <ShoppingCart/>
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Groceries</p>
                      <p className="text-xs text-slate-500">Due Sep 28, 2023</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">$150.00</p>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">
                        Estimated
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Market Watch */}
              <div className="flex flex-col gap-4 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold">Market Watch (USD/EUR)</h4>
                  <div className="flex gap-2">
                    <button className="rounded-full bg-blue-700 px-3 py-1 text-xs font-medium text-white">
                      Live
                    </button>
                    <button className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">
                      1W
                    </button>
                    <button className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">
                      1M
                    </button>
                  </div>
                </div>

                <div className="flex min-h-[300px] flex-1 flex-col rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-8 flex items-center gap-6">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">
                        Rate
                      </p>
                      <p className="text-2xl font-bold">
                        0.94{" "}
                        <span className="text-sm font-normal text-slate-400">
                          EUR
                        </span>
                      </p>
                    </div>
                    <div className="h-10 w-px bg-slate-200 dark:bg-slate-800" />
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">
                        Change
                      </p>
                      <p className="text-2xl font-bold text-emerald-500">
                        +0.0024
                      </p>
                    </div>
                  </div>

                  <div className="group/chart relative flex flex-1 items-end gap-1 pt-10">
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
                        <linearGradient
                          id="chartGradient"
                          x1="0%"
                          x2="0%"
                          y1="0%"
                          y2="100%"
                        >
                          <stop
                            offset="0%"
                            stopColor="#1152d4"
                            stopOpacity="0.2"
                          />
                          <stop
                            offset="100%"
                            stopColor="#1152d4"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>

                      <path
                        d="M0,120 Q50,110 80,130 T150,90 T250,110 T350,60 T400,80"
                        fill="none"
                        stroke="#1152d4"
                        strokeWidth="3"
                      />
                      <path
                        d="M0,120 Q50,110 80,130 T150,90 T250,110 T350,60 T400,80 V150 H0 Z"
                        fill="url(#chartGradient)"
                      />
                      <circle cx="350" cy="60" fill="#1152d4" r="5" />
                    </svg>

                    <div className="pointer-events-none absolute left-[340px] top-4 rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white shadow-lg">
                      Peak 0.9482
                    </div>
                  </div>

                  <div className="mt-4 flex justify-between text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                    <span>08:00 AM</span>
                    <span>10:00 AM</span>
                    <span>12:00 PM</span>
                    <span>02:00 PM</span>
                    <span>04:00 PM</span>
                    <span>06:00 PM</span>
                    <span>Live</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}