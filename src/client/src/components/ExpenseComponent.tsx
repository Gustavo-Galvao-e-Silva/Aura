import { useEffect, useState } from "react";
import {
  BookOpen,
  Bus,
  HeartPulse,
  Home,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

type ExpenseProps = {
  id: number;
  username: string;
  Name: string;
  Date: string;
  Value: number;
  Currency: "USD" | "BRL";
  Status: string;
  Category?: string;
  IsPaid: boolean;
  onSave?: (updatedExpense: {
    id: number;
    username: string;
    name: string;
    date: string;
    value: number;
    currency: "USD" | "BRL";
    status: string;
    category: string;
    is_paid: boolean;
  }) => Promise<void> | void;
};

type FormData = {
  name: string;
  date: string;
  value: number;
  currency: "USD" | "BRL";
  status: string;
  category: string;
};

const categoryIconMap: Record<string, LucideIcon> = {
  Education: BookOpen,
  Housing: Home,
  Food: ShoppingCart,
  Transport: Bus,
  Health: HeartPulse,
  Other: BookOpen,
};

const categoryOptions = [
  "Education",
  "Housing",
  "Food",
  "Transport",
  "Health",
  "Other",
] as const;

const statusOptions = ["Paid", "Overdue", "Upcoming"] as const;

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case "paid":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "overdue":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "upcoming":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

function buildInitialFormData(props: ExpenseProps): FormData {
  return {
    name: props.Name,
    date: props.Date,
    value: props.Value,
    currency: props.Currency,
    status: props.Status,
    category: props.Category ?? "Other",
  };
}

export default function ExpenseComponent(props: ExpenseProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>(buildInitialFormData(props));

  useEffect(() => {
    setFormData(buildInitialFormData(props));
  }, [
    props.Name,
    props.Date,
    props.Value,
    props.Currency,
    props.Status,
    props.Category,
  ]);

  const Icon = categoryIconMap[formData.category] ?? BookOpen;
  const statusClasses = getStatusClasses(formData.status);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "value" ? Number(value) : value,
    }) as FormData);
  }

  async function handleEditOrSave() {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    try {
      setIsSaving(true);

      await props.onSave?.({
        id: props.id,
        username: props.username,
        name: formData.name,
        date: formData.date,
        value: formData.value,
        currency: formData.currency,
        status: formData.status,
        category: formData.category,
        is_paid: formData.status.toLowerCase() === "paid",
      });

      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save expense:", error);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setFormData(buildInitialFormData(props));
    setIsEditing(false);
  }

  function formatValue(value: number) {
    return Number.isFinite(value) ? value.toFixed(2) : "0.00";
  }

  const brlConversion =
    formData.currency === "BRL" ? formData.value : formData.value * 5;

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            ) : (
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {formData.name}
              </p>
            )}

            <div className="mt-1">
              {isEditing ? (
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formData.category}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {isEditing ? (
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusClasses}`}
              >
                {formData.status}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-400">Due Date</p>
            {isEditing ? (
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              />
            ) : (
              <p className="text-slate-700 dark:text-slate-300">{formData.date}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400">Original</p>
            {isEditing ? (
              <div className="mt-1 flex gap-2">
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="USD">USD</option>
                  <option value="BRL">BRL</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="value"
                  value={formData.value}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            ) : (
              <p className="font-medium text-slate-900 dark:text-white">
                {formData.currency} {formatValue(formData.value)}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400">BRL Conversion</p>
            <p className="font-bold text-blue-700 dark:text-blue-400">
              R$ {formatValue(brlConversion)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleEditOrSave}
            disabled={isSaving}
            className="w-full rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : isEditing ? "Save" : "Edit"}
          </button>

          {isEditing && (
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <tr className="hidden transition-colors hover:bg-blue-700/5 md:table-row">
        <td className="px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-[180px]">
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {formData.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formData.category}
                  </p>
                </>
              )}
            </div>
          </div>
        </td>

        <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
          {isEditing ? (
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          ) : (
            formData.date
          )}
        </td>

        <td className="px-6 py-5 text-sm font-semibold text-slate-900 dark:text-white">
          {isEditing ? (
            <div className="flex min-w-[180px] gap-2">
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="USD">USD</option>
                <option value="BRL">BRL</option>
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                name="value"
                value={formData.value}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          ) : (
            <>
              {formData.currency} {formatValue(formData.value)}
            </>
          )}
        </td>

        <td className="px-6 py-5 text-sm font-bold text-blue-700 dark:text-blue-400">
          R$ {formatValue(brlConversion)}
        </td>

        <td className="px-6 py-5">
          {isEditing ? (
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusClasses}`}
            >
              {formData.status}
            </span>
          )}
        </td>

        <td className="px-6 py-5 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={handleEditOrSave}
              disabled={isSaving}
              className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : isEditing ? "Save" : "Edit"}
            </button>

            {isEditing && (
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}