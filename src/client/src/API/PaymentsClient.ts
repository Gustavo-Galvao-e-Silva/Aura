import apiClient from "./client";

export type WalletBalance = {
  username: string;
  brl_available: number;
  usd_available: number;
  brl_pending: number;
  total_deposited_brl: number;
  total_spent_brl: number;
};

export type TransactionItem = {
  id: number;
  created_at: string;
  transaction_type: string;
  status: string;
  asset: string;
  direction: string;
  amount: number;
  balance_before: number | null;
  balance_after: number | null;
  description: string;
  stripe_payment_intent_id: string | null;
};

export async function getBalance(username: string): Promise<WalletBalance> {
  const res = await apiClient.get(`/payments/balance/${username}`);
  return res.data as WalletBalance;
}

export async function getTransactionHistory(
  username: string,
  limit = 50,
  offset = 0,
): Promise<TransactionItem[]> {
  const res = await apiClient.get(`/payments/history/${username}`, {
    params: { limit, offset },
  });
  return res.data as TransactionItem[];
}

export async function createCheckoutSession(
  username: string,
  amountUsd: number,
): Promise<{ checkout_url: string; session_id: string }> {
  const res = await apiClient.post("/payments/checkout", {
    username,
    amount_usd: amountUsd,
  });
  return res.data;
}
