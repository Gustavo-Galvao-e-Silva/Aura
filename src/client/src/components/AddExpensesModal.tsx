import { Upload, X } from "lucide-react";
import { useState } from "react";
import { useUser } from "@clerk/react-router";
import { uploadInvoice } from "../API/ExpensesClient";

type AddExpensesModalProps = {
  CloseModal: () => void;
};

export default function AddExpensesModal({
  CloseModal,
}: AddExpensesModalProps) {
  const { user } = useUser();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [expenseName, setExpenseName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "BRL">("USD");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("Education");
  const [notes, setNotes] = useState("");

  async function handleUploadInvoice() {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }

    if (!user?.username) {
      alert("No username found for current user.");
      return;
    }

    try {
      setIsUploading(true);

      console.log("Uploading file:", selectedFile);
      console.log("Uploading for username:", user.username);

      const data = await uploadInvoice(selectedFile, user.username);

      console.log("Upload success:", data);
      CloseModal();
    } catch (error: any) {
      console.error("Upload failed:", error);
      console.error("Response data:", error?.response?.data);

      alert(
        JSON.stringify(error?.response?.data ?? error?.message ?? error, null, 2)
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Add New Expense
          </h3>

          <button
            type="button"
            onClick={CloseModal}
            className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <div className="flex flex-col">
              <label className="mb-4 block text-sm font-bold text-slate-700 dark:text-slate-300">
                Upload Receipt/Invoice
              </label>

              <label
                htmlFor="expense-file"
                className="group flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-700/20 bg-blue-700/5 p-8 text-center transition-all hover:border-blue-700/40"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-700/10 text-blue-700 transition-transform group-hover:scale-110">
                  <Upload className="h-8 w-8" />
                </div>

                <p className="mb-1 font-bold text-slate-900 dark:text-white">
                  Drop your file here or click to browse
                </p>
                <p className="text-xs text-slate-500">
                  Supported formats: PDF, JPG, PNG (Max 5MB)
                </p>

                {selectedFile && (
                  <p className="mt-3 break-all text-xs font-semibold text-blue-700">
                    {selectedFile.name}
                  </p>
                )}
              </label>

              <input
                id="expense-file"
                className="hidden"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSelectedFile(file);
                }}
              />

              {selectedFile && (
                <button
                  type="button"
                  onClick={handleUploadInvoice}
                  disabled={isUploading}
                  className="mt-4 rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/25 transition-all hover:opacity-90 disabled:opacity-60"
                >
                  {isUploading ? "Uploading invoice..." : "Upload Invoice"}
                </button>
              )}
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Manual Entry
              </label>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Expense Name
                </label>
                <input
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  className="w-full rounded-xl border-none bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-700 dark:bg-slate-800"
                  placeholder="e.g. Tuition Fees, Rent"
                  type="text"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Amount
                  </label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border-none bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-700 dark:bg-slate-800"
                    placeholder="0.00"
                    type="number"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as "USD" | "BRL")}
                    className="w-full rounded-xl border-none bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-700 dark:bg-slate-800"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="BRL">BRL (R$)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Due Date
                  </label>
                  <input
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border-none bg-slate-50 px-4 py-3 text-sm text-slate-500 focus:ring-2 focus:ring-blue-700 dark:bg-slate-800"
                    type="date"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border-none bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-700 dark:bg-slate-800"
                  >
                    <option>Education</option>
                    <option>Housing</option>
                    <option>Food</option>
                    <option>Transport</option>
                    <option>Health</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-24 w-full resize-none rounded-xl border-none bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-700 dark:bg-slate-800"
                  placeholder="Add any extra details..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={CloseModal}
            className="px-6 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel
          </button>

          <button
            type="button"
            className="rounded-xl bg-blue-700 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-700/25 transition-all hover:opacity-90 active:scale-95"
          >
            Add Expense
          </button>
        </div>
      </div>
    </div>
  );
}