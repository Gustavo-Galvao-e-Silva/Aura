import axios from "axios";
import apiClient from "./client";

export type ExpenseStats = {
  total_to_be_paid: number;
  upcoming_total: number;
  overdue_total: number;
};

export type CreateExpensePayload = {
  username: string;
  name: string;
  amount: number;
  currency: "USD" | "BRL";
  due_date: string;
  category: string;
  notes?: string;
};


export async function uploadInvoice(file: File, username: string) {
  const formData = new FormData();
  formData.append("username", username);
  formData.append("file", file);

  const response = await axios.post(
    "http://localhost:8000/upload-invoice",
    formData
  );

  return response.data;
}

export async function getExpenseStats(username?: string) {
  const response = await apiClient.get("/get-expense-stats", {
    params: username ? { username } : {},
  });

  return response.data as ExpenseStats;
}

export async function createExpense(payload: CreateExpensePayload) {
  const response = await apiClient.post("/create-expense", payload);
  return response.data;
}