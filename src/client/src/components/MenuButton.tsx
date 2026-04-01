import type { JSX } from "react";
import { Link, useLocation } from "react-router";

type MenuButtonProps = {
  redirect_link: string;
  Icon: JSX.Element;
  Name: string;
};

export default function MenuButton({ redirect_link, Icon, Name }: MenuButtonProps) {
  const { pathname } = useLocation();
  const active = pathname === redirect_link;

  return (
    <Link
      to={redirect_link}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
      style={{
        color: active ? "#DCD7C9" : "rgba(220,215,201,0.5)",
        background: active ? "rgba(162,123,92,0.12)" : "transparent",
      }}
    >
      {Icon}
      {Name}
    </Link>
  );
}
