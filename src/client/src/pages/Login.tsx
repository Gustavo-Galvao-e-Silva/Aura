import { Banknote, Eye, Lock, LogIn, Mail, MoveLeft, Wallet } from "lucide-react";

export default function FinGlobalLoginPage() {
  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex h-full flex-col">
        <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-4">
          <div className="flex w-full max-w-[480px] flex-col">
            <a
              className="mb-4 flex items-center gap-2 self-start text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
              href="/"
            >
              <span className="material-symbols-outlined text-lg">
                <MoveLeft/>
              </span>
              Back to home
            </a>

            <div className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="relative h-40 w-full overflow-hidden bg-blue-700/10">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage:
                      "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCtmt3HY53_RY2k5KCA-M3vSz7CDGk3X_WhIjY8LQDymCYCEdTV1yGrmeM4Mk_vsZXkeeQv40TTGSBc-s0CVhs0lj--6i_Q9UyVIwiIO1SodxhyRRA1X-5FylBECQ9afJydn9H9OSB-CCMJY4g6o7Ot6H18Cu-Omk_3Et7uSFY0XrGuydz6wCD5ecdig16w7_VppAEH2oHocQ5JT6HLc32caziOileWxJrC_75Mg4HySkgQvBBh84SpDrLxk2qKwXNxVraEErs3-Wg6')",
                  }}
                  aria-label="Cheerful college students studying together on campus"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent dark:from-slate-900" />
              </div>

              <div className="flex flex-col gap-5 px-8 pt-4 pb-6">
                <a
                  className="mb-1 flex items-center gap-2 transition-opacity hover:opacity-80"
                  href="/"
                >
                  <div className="text-blue-700">
                    <span
                      className="material-symbols-outlined text-4xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      <Wallet/>
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Thea.do
                  </h1>
                </a>

                <div className="flex flex-col gap-1">
                  <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                    Welcome back
                  </h2>
                  <p className="text-base text-slate-500 dark:text-slate-400">
                    Manage your student finances with ease.
                  </p>
                </div>

                <form className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Email
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <span className="material-symbols-outlined text-lg">
                          <Mail/>
                        </span>
                      </div>
                      <input
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        placeholder="Enter your student email"
                        type="email"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Password
                      </label>
                      <a
                        className="text-sm font-medium text-blue-700 hover:underline"
                        href="#"
                      >
                        Forgot password?
                      </a>
                    </div>

                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <span className="material-symbols-outlined text-lg">
                          <Lock/>
                        </span>
                      </div>
                      <input
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        placeholder="Enter your password"
                        type="password"
                      />
                      <button
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-lg">
                            <Eye/>
                        </span>
                      </button>
                    </div>
                  </div>

                  <button
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-bold text-white transition-colors hover:bg-blue-800"
                    type="submit"
                  >
                    Log In
                    <span className="material-symbols-outlined text-sm">
                      <LogIn/>
                    </span>
                  </button>
                </form>

                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-slate-500 dark:bg-slate-900">
                      New to FinGlobal?
                    </span>
                  </div>
                </div>

                <a href="/register" className="w-full rounded-lg bg-blue-700/10 px-4 py-3 font-bold text-blue-700 transition-colors hover:bg-blue-700/20 flex justify-center items-center">
                  Create a student account
                </a>

                <div className="text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Protected by secure bank-grade encryption.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="shrink-0 border-t border-slate-200 px-6 py-4 text-sm text-slate-500 dark:border-slate-800">
          <div className="flex flex-wrap justify-center gap-6">
            <a className="hover:text-blue-700" href="#">
              Terms of Service
            </a>
            <a className="hover:text-blue-700" href="#">
              Privacy Policy
            </a>
            <a className="hover:text-blue-700" href="#">
              Help Center
            </a>
            <span>© 2024 FinGlobal Inc.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}