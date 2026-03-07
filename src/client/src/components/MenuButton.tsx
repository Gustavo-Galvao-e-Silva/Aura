import type { JSX } from "react";
import { Link } from "react-router";

type MenuButtonProps = {
  redirect_link: string;
  Icon: JSX.Element;
  Name: string;
};

export default function MenuButton(props: MenuButtonProps) {
  return (
    <Link
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      to={props.redirect_link}
    >
      {props.Icon}
      <span className="text-sm font-medium">{props.Name}</span>
    </Link>
  );
}