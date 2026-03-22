import { apiGet, apiPost } from "@/lib/api";

/** Matches WalletAccount from API (bigint fields as strings in JSON) */
export type WalletAccountDto = {
  id: string;
  balance_cents: string;
  currency: string;
  auto_reload_enabled: boolean;
  auto_reload_threshold_cents: string | null;
  auto_reload_amount_cents: string | null;
  stripe_payment_method_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WalletTransactionDto = {
  id: string;
  type: "credit" | "debit";
  amount_cents: string;
  balance_after_cents: string;
  reference_type: string;
  reference_id: string | null;
  description: string;
  created_at: string;
};

export function getWalletMe() {
  return apiGet<WalletAccountDto>("/wallet/me");
}

export function getWalletTransactions(opts?: { limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGet<WalletTransactionDto[]>(`/wallet/me/transactions${suffix}`);
}

export type TopupPayload = {
  amount_cents: number;
  description?: string;
};

/** Dev/simulated top-up — backend uses WalletService.topup */
export function postWalletTopup(body: TopupPayload) {
  return apiPost<WalletAccountDto>("/wallet/me/topup", body);
}

/** bigint from API is JSON-serialized as string */
export function centsToNumber(cents: string | number): number {
  return typeof cents === "string" ? Number(cents) : cents;
}

export function dollarsInputToCents(dollars: number): number {
  return Math.round(dollars * 100);
}