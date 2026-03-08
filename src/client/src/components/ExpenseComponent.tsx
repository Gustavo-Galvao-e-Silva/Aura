import {
  BookOpen,
  Bus,
  HeartPulse,
  Home,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

type ExpenseProps = {
  Name: string;
  Date: string;
  Value: number;
  Currency: string;
  Status: string;
  Category?: string;
};

const categoryIconMap: Record<string, LucideIcon> = {
  Education: BookOpen,
  Housing: Home,
  Food: ShoppingCart,
  Transport: Bus,
  Health: HeartPulse,
  Other: BookOpen,
};

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case "paid":
      return "bg-green-100 text-green-700";
    case "overdue":
      return "bg-red-100 text-red-700";
    case "upcoming":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function ExpenseComponent(props: ExpenseProps) {
  const Icon = categoryIconMap[props.Category ?? "Other"] ?? BookOpen;
  const statusClasses = getStatusClasses(props.Status);

  return (
    <>
      {/* Mobile card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {props.Name}
            </p>
            <p className="mt-1 text-xs text-slate-500">{props.Category ?? "Other"}</p>
          </div>

          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusClasses}`}
          >
            {props.Status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-400">Due Date</p>
            <p className="text-slate-700 dark:text-slate-300">{props.Date}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400">Original</p>
            <p className="font-medium text-slate-900 dark:text-white">
              {props.Currency} {props.Value}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400">BRL Conversion</p>
            <p className="font-bold text-blue-700">
              R$ {(props.Value * 5).toFixed(2)}
            </p>
          </div>
        </div>

        <button className="mt-4 w-full rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-800">
          Mark as Paid
        </button>
      </div>

      {/* Desktop row */}
      <tr className="hidden transition-colors hover:bg-blue-700/5 md:table-row">
        <td className="px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {props.Name}
            </p>
          </div>
        </td>

        <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
          {props.Date}
        </td>

        <td className="px-6 py-5 text-sm font-semibold text-slate-900 dark:text-white">
          {props.Currency} {props.Value}
        </td>

        <td className="px-6 py-5 text-sm font-bold text-blue-700">
          R$ {(props.Value * 5).toFixed(2)}
        </td>

        <td className="px-6 py-5">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusClasses}`}
          >
            {props.Status}
          </span>
        </td>

        <td className="px-6 py-5 text-right">
          <button className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-800">
            Mark as Paid
          </button>
        </td>
      </tr>
    </>
  );
}