import { ClockFading, Home, Route, ScrollText, Wallet } from "lucide-react";
import MenuButton from "./MenuButton";



export default function Navbar(){
    return (
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
             
                <MenuButton redirect_link="/dashboard" Name="Dashboard" Icon={<Home size={25}/>}/>
                <MenuButton redirect_link="/expenses" Name="Expenses" Icon={<ScrollText/>}/>
                <MenuButton redirect_link="/routes" Name="FX Routes" Icon={<Route/>}/>
                <MenuButton redirect_link="/scheduler" Name="Bill Scheduler" Icon={<ClockFading/>}/>
              

            </nav>
            
            </aside>
    )
}