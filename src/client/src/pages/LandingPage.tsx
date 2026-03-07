import { Calendar, Globe, Mail, Menu, TrendingUp, Wallet, Waypoints } from "lucide-react";

export default function FinGlobalLandingPage() {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-700 rounded-lg text-white">
                <span className="material-symbols-outlined block">
                  <Wallet/>
                </span>
              </div>
              <span className="text-xl font-bold tracking-tight"> Thea.do </span>
            </div>

            <nav className="hidden md:flex space-x-8 items-center">
              <a
                className="text-sm font-medium hover:text-blue-700 transition-colors"
                href="#features"
              >
                Features
              </a>
              <a
                className="text-sm font-medium hover:text-blue-700 transition-colors"
                href="#solutions"
              >
                Solutions
              </a>
              <a
                className="text-sm font-medium hover:text-blue-700 transition-colors"
                href="#pricing"
              >
                Pricing
              </a>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
              <a href="/login" className="text-sm font-semibold hover:text-blue-700 transition-colors">
                Log In
              </a>

              <a className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm">
                Get Started
              </a>
            </nav>

            <button
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open menu"
            >
              <span className="material-symbols-outlined text-2xl"> <Menu/> </span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-700/10 text-blue-700 text-xs font-bold mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-700 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-700" />
                  </span>
                  NEW: Real-time FX Optimization
                </div>

                <h1 className="text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight mb-6">
                  Smart Global Finance for{" "}
                  <span className="text-blue-700">the Modern Student</span>
                </h1>

                <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
                  Save on tuition payments, international transfers, and
                  managing your daily living costs. Start saving on every
                  international transaction today with zero stress.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-4 rounded-xl text-lg font-bold transition-all shadow-lg shadow-blue-700/25">
                    Start Free Trial
                  </button>
                  <button className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-8 py-4 rounded-xl text-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                    Watch Demo
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -top-20 -right-20 w-96 h-96 bg-blue-700/20 rounded-full blur-[100px]" />
                <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden transform lg:rotate-3 hover:rotate-0 duration-300">
                  <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      dashboard.finglobal.com
                    </div>
                  </div>

                  <img
                    alt="International Student Lifestyle"
                    className="w-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSwMZm1Xyd6gmczEj2HrQVr9A6h-MbPDJUx9-pSilmJ5g9uKFFotNYzVIuQ3RbaM_-2fJItNEC6DhmNp4-gIOfqU5cdLYONsRyTc77BzKUjH3an3ltH_SV4AvnB1bHYOJP0zhvX3VENJw8BFkh2gbTIlqWW3_FRnvLgqD3YX9B8khSvUO8OkmtPvyj_154TUQC6rdGlo-II_JwqVxtaHZ8JbVovB7lf10yq33FyraDlIjQOjBL2ZzhrjU9fWAWU4jB_R0qbsRtwJF2"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-white dark:bg-slate-950" id="features">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h2 className="text-blue-700 font-bold text-sm tracking-widest uppercase mb-3">
                Key Features
              </h2>
              <p className="text-4xl font-black text-slate-900 dark:text-white mb-6">
                Powerful tools to manage your global wealth
              </p>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Our suite of features is designed to give you complete control
                over your international finances with zero stress.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="group p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-blue-700/30 hover:shadow-xl hover:shadow-blue-700/5 transition-all">
                <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center mb-6 shadow-sm text-blue-700">
                  <span className="material-symbols-outlined text-3xl">
                    <TrendingUp/>
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-4">
                  Currency Conversion Tracking
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Real-time tracking and intelligent alerts for the best
                  conversion times. Save thousands on your tuition and rent by
                  timing your transfers perfectly with 150+ global currencies.
                </p>
              </div>

              <div className="group p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-blue-700/30 hover:shadow-xl hover:shadow-blue-700/5 transition-all">
                <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center mb-6 shadow-sm text-blue-700">
                  <span className="material-symbols-outlined text-3xl">
                        <Calendar/>
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-4">Smart Bill Scheduling</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Never miss a payment again. Our automated scheduling handles
                  your tuition and monthly bills in any currency, with smart
                  reminders so you can focus on your studies.
                </p>
              </div>

              <div className="group p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-blue-700/30 hover:shadow-xl hover:shadow-blue-700/5 transition-all">
                <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center mb-6 shadow-sm text-blue-700">
                  <span className="material-symbols-outlined text-3xl">
                    <Waypoints/>
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-4">FX Route Optimization</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Our proprietary algorithm scans global networks to find the
                  cheapest and fastest routes, saving you up to 3% on every
                  single cross-border transfer.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4">
            <div className="bg-slate-900 rounded-[2.5rem] p-12 lg:p-20 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-700/40 to-transparent" />
              <div className="relative z-10 max-w-3xl mx-auto">
                <h2 className="text-4xl lg:text-5xl font-black text-white mb-8">
                  Ready to master your student finances abroad?
                </h2>
                <p className="text-lg text-slate-300 mb-10">
                  Join thousands of international students who are saving more
                  and worrying less about their global money transfers.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="bg-blue-700 hover:bg-blue-800 text-white px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-lg shadow-blue-700/20">
                    Get Started Now
                  </button>
                  <button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-10 py-4 rounded-xl text-lg font-bold transition-all backdrop-blur-sm">
                    Talk to Sales
                  </button>
                </div>
                <p className="mt-8 text-sm text-slate-400">
                  No credit card required. Free 14-day trial.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-1.5 bg-blue-700 rounded-lg text-white">
                  <span className="material-symbols-outlined block">
                    <Wallet/>
                  </span>
                </div>
                <span className="text-xl font-bold tracking-tight">
                  FinGlobal
                </span>
              </div>

              <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                A smarter platform for international students managing tuition,
                rent, and cross-border transfers.
              </p>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-700 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-xl">
                    <Globe/>
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-700 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-xl"> <Mail/> </span>
                </div>
              </div>
            </div>

            <div>
              <h5 className="font-bold mb-6">Product</h5>
              <ul className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
                <li>
                  <a className="hover:text-blue-700 transition-colors" href="#">
                    Features
                  </a>
                </li>
                <li>
                  <a className="hover:text-blue-700 transition-colors" href="#">
                    Pricing
                  </a>
                </li>
                <li>
                  <a className="hover:text-blue-700 transition-colors" href="#">
                    Security
                  </a>
                </li>
                <li>
                  <a className="hover:text-blue-700 transition-colors" href="#">
                    Roadmap
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold mb-6">Company</h5>
              <ul className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
                <li>
                  <a className="hover:text-blue-700 transition-colors" href="#">
                    About
                  </a>
                </li>
                <li>
                  <a className="hover:text-blue-700 transition-colors" href="#">
                    Careers
                  </a>
                </li>
                <li>
                  <a className="hover:text-blue-700 transition-colors" href="#">
                    Press
                  </a>
                </li>
                <li>
                  <a className="hover:text-blue-700 transition-colors" href="#">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold mb-6">Legal</h5>
              <ul className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
                <li>
                  <a className="hover:text-blue-700 transition-colors" href="#">
                    Privacy
                  </a>
                </li>
                <li>
                  <a className="hover:text-blue-700 transition-colors" href="#">
                    Terms
                  </a>
                </li>
                <li>
                  <a className="hover:text-blue-700 transition-colors" href="#">
                    Compliance
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              © 2024 FinGlobal Inc. All rights reserved.
            </p>

            <div className="flex gap-8 text-sm text-slate-500">
              <span className="flex items-center gap-1 cursor-pointer hover:text-blue-700 transition-colors">
                <span className="material-symbols-outlined text-base">
                  language
                </span>
                English
              </span>
              <span className="flex items-center gap-1 cursor-pointer hover:text-blue-700 transition-colors">
                <span className="material-symbols-outlined text-base">
                  verified_user
                </span>
                System Status
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}