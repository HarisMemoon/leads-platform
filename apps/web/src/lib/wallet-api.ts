import { apiGet, apiPatch, apiPost } from "@/lib/api";

/** Matches WalletAccount from API (bigint fields as strings in JSON) */
export type WalletAccountDto = {
  id: string;
  balance_cents: string;
  currency: string;
  auto_reload_enabled: boolean;
  /** True after user checks "Save this card for auto-reload" on a completed top-up */
  auto_reload_opt_in?: boolean;
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

export type WalletTransactionsPage = {
  items: WalletTransactionDto[];
  total: number;
  limit: number;
  offset: number;
};

export function getWalletTransactions(opts?: {
  limit?: number;
  offset?: number;
  type?: "credit" | "debit";
}) {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  if (opts?.type) q.set("type", opts.type);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGet<WalletTransactionsPage>(`/wallet/me/transactions${suffix}`);
}

export type WalletTransactionTotals = {
  transaction_count: number;
  total_credits_cents: string;
  total_debits_cents: string;
};

export function getWalletTransactionTotals() {
  return apiGet<WalletTransactionTotals>("/wallet/me/transaction-totals");
}

export type PaymentMethodPreview = {
  paymentMethod: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null;
};

export function getPaymentMethodPreview() {
  return apiGet<PaymentMethodPreview>("/stripe/payment-method-preview");
}

export type TopupPayload = {
  amount_cents: number;
  description?: string;
};

/** Dev/simulated top-up — backend uses WalletService.topup */
export function postWalletTopup(body: TopupPayload) {
  return apiPost<WalletAccountDto>("/wallet/me/topup", body);
}

export function createStripePaymentIntent(
  amountCents: number,
  saveForFutureUse?: boolean,
) {
  const q =
    saveForFutureUse === true
      ? "?save_card=1"
      : "";
  return apiPost<{ clientSecret: string }>(
    `/stripe/create-payment-intent${q}`,
    { amountCents },
  );
}

/** Apply wallet credit immediately after `confirmCardPayment` (webhook may still arrive; credit is idempotent). */
export function confirmStripeWalletTopUp(
  paymentIntentId: string,
  opts?: { savePaymentMethodForAutoReload?: boolean },
) {
  return apiPost<WalletAccountDto>("/stripe/confirm-wallet-topup", {
    paymentIntentId,
    ...(opts?.savePaymentMethodForAutoReload
      ? { savePaymentMethodForAutoReload: true }
      : {}),
  });
}

export function patchWalletAutoReload(body: {
  auto_reload_enabled: boolean;
  auto_reload_threshold_cents?: number;
  auto_reload_amount_cents?: number;
}) {
  return apiPatch<WalletAccountDto>("/wallet/me/auto-reload", body);
}

/**
 * Persists a Stripe PaymentMethod id server-side: attaches it to the user’s Stripe Customer,
 * sets it as default for invoices, and stores `stripe_payment_method_id` on the wallet for auto-reload.
 * Obtain `paymentMethodId` from Stripe.js after a successful card payment, or via `stripe.createPaymentMethod`.
 */
export function saveStripePaymentMethod(paymentMethodId: string) {
  return apiPost<{ success: boolean }>("/stripe/save-payment-method", {
    paymentMethodId,
  });
}

/** bigint from API is JSON-serialized as string */
export function centsToNumber(cents: string | number): number {
  return typeof cents === "string" ? Number(cents) : cents;
}

export function dollarsInputToCents(dollars: number): number {
  return Math.round(dollars * 100);
}