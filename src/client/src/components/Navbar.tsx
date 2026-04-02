import {
  ClockFading,
  Home,
  Route,
  ScrollText,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import MenuButton from "./MenuButton";

export default function Navbar() {
  return (
    <aside
      className="hidden w-60 shrink-0 flex-col md:flex"
      style={{
        background: "#253229",
        borderRight: "1px solid rgba(162,123,92,0.1)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <img src="/logo_v1.png" className="h-14 w-auto" alt="" />
        <div>
          <h1 className="text-base font-extrabold leading-tight tracking-tight text-[#DCD7C9]">
            Revellio
          </h1>
          <p
            className="text-[11px]"
            style={{ color: "rgba(220,215,201,0.45)" }}
          >
            Student Finance
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        <MenuButton
          redirect_link="/dashboard"
          Name="Dashboard"
          Icon={<Home size={18} />}
        />
        <MenuButton
          redirect_link="/expenses"
          Name="Expenses"
          Icon={<ScrollText size={18} />}
        />
        <MenuButton
          redirect_link="/routes"
          Name="FX Routes"
          Icon={<Route size={18} />}
        />
        <MenuButton
          redirect_link="/scheduler"
          Name="Bill Scheduler"
          Icon={<ClockFading size={18} />}
        />
        <MenuButton
          redirect_link="/wallet"
          Name="Wallet"
          Icon={<Wallet size={18} />}
        />
        <MenuButton
          redirect_link="/audit"
          Name="Audit Trail"
          Icon={<ShieldCheck size={18} />}
        />
      </nav>
    </aside>
  );
}
