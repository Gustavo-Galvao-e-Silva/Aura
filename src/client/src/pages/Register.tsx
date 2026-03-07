import { User } from "lucide-react";

export default function FinGlobalRegisterPage() {

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
        <div className="flex items-center gap-2 text-blue-700">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-700 text-white">
            <span className="material-symbols-outlined text-2xl">
              account_balance
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            FinGlobal
          </h1>
        </div>

        <a
          className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-400"
          href="#"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to home
        </a>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-32 items-end bg-gradient-to-br from-blue-700 to-blue-600 p-6">
              <h2 className="text-2xl font-bold text-white">Create Account</h2>
            </div>

            <div className="p-8">
              <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
                Join FinGlobal to manage your student finances, track loans, and
                plan your budget.
              </p>

              <form className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl text-slate-400">
                      <User/>
                    </span>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition-all focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-800"
                      placeholder="John Doe"
                      type="text"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Student Email
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl text-slate-400">
                      school
                    </span>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition-all focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-800"
                      placeholder="name@university.edu"
                      type="email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl text-slate-400">
                        lock
                      </span>
                      <input
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition-all focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-800"
                        placeholder="••••••••"
                        type="password"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Confirm
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl text-slate-400">
                        lock_reset
                      </span>
                      <input
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition-all focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-800"
                        placeholder="••••••••"
                        type="password"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <input
                    className="mt-1 rounded border-slate-300 text-blue-700 focus:ring-blue-700 dark:border-slate-700"
                    id="terms"
                    type="checkbox"
                  />
                  <label
                    className="text-xs leading-relaxed text-slate-500 dark:text-slate-400"
                    htmlFor="terms"
                  >
                    I agree to the{" "}
                    <a className="text-blue-700 hover:underline" href="#">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a className="text-blue-700 hover:underline" href="#">
                      Privacy Policy
                    </a>
                    .
                  </label>
                </div>

                <button
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 py-4 font-bold text-white transition-all hover:bg-blue-800"
                  type="submit"
                >
                  Create Account
                  <span className="material-symbols-outlined">
                    arrow_forward
                  </span>
                </button>
              </form>

              <div className="mt-8 border-t border-slate-100 pt-6 text-center dark:border-slate-800">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Already have an account?{" "}
                  <a className="font-semibold text-blue-700 hover:underline" href="#">
                    Log in
                  </a>
                </p>
              </div>
            </div>
          </div>

          <footer className="mt-8 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-600">
              © 2024 FinGlobal Financial Services. Secure 256-bit SSL encrypted.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}