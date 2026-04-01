import { Upload, X } from "lucide-react";
import { useState } from "react";
import { useUser } from "@clerk/react-router";
import {
  uploadInvoice,
  createExpense,
} from "../API/ExpensesClient";

type AddExpensesModalProps = {
  CloseModal: () => void;
};

const C = {
  bg: "#2C3930",
  surface: "rgba(63,79,68,0.18)",
  border: "rgba(162,123,92,0.1)",
  rose: "#A27B5C",
  cream: "#DCD7C9",
  muted: "rgba(220,215,201,0.5)",
};

export default function AddExpensesModal({
  CloseModal,
}: AddExpensesModalProps) {
  const { user } = useUser();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingExpense, setIsCreatingExpense] = useState(false);

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

  async function handleCreateExpense() {
    if (!user?.username) {
      alert("No username found for current user.");
      return;
    }

    if (!expenseName.trim()) {
      alert("Expense name is required.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("Amount must be greater than 0.");
      return;
    }

    if (!dueDate) {
      alert("Due date is required.");
      return;
    }

    try {
      setIsCreatingExpense(true);

      const payload = {
        username: user.username,
        name: expenseName.trim(),
        amount: Number(amount),
        currency,
        due_date: dueDate,
        category,
        notes: notes.trim(),
      };

      const data = await createExpense(payload);

      console.log("Manual expense created:", data);
      CloseModal();
    } catch (error: any) {
      console.error("Create expense failed:", error);
      console.error("Response data:", error?.response?.data);

      alert(
        JSON.stringify(error?.response?.data ?? error?.message ?? error, null, 2)
      );
    } finally {
      setIsCreatingExpense(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgba(12, 18, 14, 0.72)" }}
      onClick={CloseModal}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-6"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <h3 className="text-xl font-bold" style={{ color: C.cream }}>
            Add New Expense
          </h3>

          <button
            type="button"
            onClick={CloseModal}
            className="transition-colors"
            style={{ color: C.muted }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <div className="flex flex-col">
              <label
                className="mb-4 block text-sm font-bold"
                style={{ color: C.cream }}
              >
                Upload Receipt/Invoice
              </label>

              <label
                htmlFor="expense-file"
                className="group flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all"
                style={{
                  borderColor: "rgba(162,123,92,0.22)",
                  background: "rgba(63,79,68,0.18)",
                }}
              >
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-transform group-hover:scale-110"
                  style={{
                    background: "rgba(162,123,92,0.12)",
                    color: C.rose,
                  }}
                >
                  <Upload className="h-8 w-8" />
                </div>

                <p className="mb-1 font-bold" style={{ color: C.cream }}>
                  Drop your file here or click to browse
                </p>
                <p className="text-xs" style={{ color: C.muted }}>
                  Supported formats: PDF, JPG, PNG (Max 5MB)
                </p>

                {selectedFile && (
                  <p
                    className="mt-3 break-all text-xs font-semibold"
                    style={{ color: C.rose }}
                  >
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
                  className="mt-4 rounded-xl px-6 py-3 text-sm font-bold transition-all disabled:opacity-60"
                  style={{ background: C.rose, color: C.bg }}
                >
                  {isUploading ? "Uploading invoice..." : "Upload Invoice"}
                </button>
              )}
            </div>

            <div className="space-y-4">
              <label
                className="block text-sm font-bold"
                style={{ color: C.cream }}
              >
                Manual Entry
              </label>

              <div>
                <label
                  className="mb-1 block text-xs font-semibold"
                  style={{ color: C.muted }}
                >
                  Expense Name
                </label>
                <input
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  className="w-full rounded-xl bg-transparent px-4 py-3 text-sm outline-none"
                  style={{
                    border: `1px solid ${C.border}`,
                    color: C.cream,
                    caretColor: C.rose,
                  }}
                  placeholder="e.g. Tuition Fees, Rent"
                  type="text"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="mb-1 block text-xs font-semibold"
                    style={{ color: C.muted }}
                  >
                    Amount
                  </label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl bg-transparent px-4 py-3 text-sm outline-none"
                    style={{
                      border: `1px solid ${C.border}`,
                      color: C.cream,
                      caretColor: C.rose,
                    }}
                    placeholder="0.00"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label
                    className="mb-1 block text-xs font-semibold"
                    style={{ color: C.muted }}
                  >
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as "USD" | "BRL")}
                    className="w-full rounded-xl bg-transparent px-4 py-3 text-sm outline-none"
                    style={{
                      border: `1px solid ${C.border}`,
                      color: C.cream,
                      backgroundColor: C.bg,
                    }}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="BRL">BRL (R$)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="mb-1 block text-xs font-semibold"
                    style={{ color: C.muted }}
                  >
                    Due Date
                  </label>
                  <input
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl bg-transparent px-4 py-3 text-sm outline-none"
                    style={{
                      border: `1px solid ${C.border}`,
                      color: C.cream,
                      colorScheme: "dark",
                    }}
                    type="date"
                  />
                </div>

                <div>
                  <label
                    className="mb-1 block text-xs font-semibold"
                    style={{ color: C.muted }}
                  >
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl bg-transparent px-4 py-3 text-sm outline-none"
                    style={{
                      border: `1px solid ${C.border}`,
                      color: C.cream,
                      backgroundColor: C.bg,
                    }}
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
                <label
                  className="mb-1 block text-xs font-semibold"
                  style={{ color: C.muted }}
                >
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-24 w-full resize-none rounded-xl bg-transparent px-4 py-3 text-sm outline-none"
                  style={{
                    border: `1px solid ${C.border}`,
                    color: C.cream,
                    caretColor: C.rose,
                  }}
                  placeholder="Add any extra details..."
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-3 p-6"
          style={{
            borderTop: `1px solid ${C.border}`,
            background: "rgba(63,79,68,0.12)",
          }}
        >
          <button
            type="button"
            onClick={CloseModal}
            className="px-6 py-2.5 text-sm font-bold transition-colors"
            style={{ color: C.muted }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCreateExpense}
            disabled={isCreatingExpense}
            className="rounded-xl px-8 py-2.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
            style={{ background: C.rose, color: C.bg }}
          >
            {isCreatingExpense ? "Adding..." : "Add Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}