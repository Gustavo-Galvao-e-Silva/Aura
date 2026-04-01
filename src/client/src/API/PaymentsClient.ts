import apiClient from "./client";

export async function getBalance(username: string) {
  const response = await apiClient.get(`/payments/balance/${username}`);
  return response.data as { username: string; usd_balance: number; brl_balance: number };
}

export async function createCheckoutSession(username: string, amountUsd: number) {
  const response = await apiClient.post("/payments/create-checkout-session", {
    username,
    amount_usd: amountUsd,
  });
  return response.data as { checkout_url: string; session_id: string };
}
