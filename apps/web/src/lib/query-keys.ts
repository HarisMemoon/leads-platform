/** Centralized TanStack Query keys for cache invalidation. */
export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  wallet: {
    me: ["wallet", "me"] as const,
    transactions: (opts?: {
      limit?: number;
      offset?: number;
      type?: string;
    }) => ["wallet", "transactions", opts ?? {}] as const,
    transactionTotals: ["wallet", "transaction-totals"] as const,
  },
  stripe: {
    paymentMethodPreview: ["stripe", "payment-method-preview"] as const,
  },
  onboarding: {
    me: ["onboarding", "me"] as const,
  },
  dashboard: {
    summary: ["dashboard", "summary"] as const,
  },
  leads: {
    my: (opts?: {
      page?: number;
      limit?: number;
      purchaseType?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    }) => ["leads", "my", opts ?? {}] as const,
    detail: (leadId: string) => ["leads", "detail", leadId] as const,
    marketplace: (opts: Record<string, unknown>) =>
      ["leads", "marketplace", opts] as const,
  },
  distribution: {
    rules: ["distribution", "rules"] as const,
    me: ["distribution", "me"] as const,
  },
  marketAlerts: {
    me: ["market-alerts", "me"] as const,
  },
  admin: {
    metrics: ["admin", "metrics"] as const,
    audit: ["admin", "audit"] as const,
    engine: ["admin", "distribution-engine"] as const,
  },
  subscriptions: {
    me: ["subscriptions", "me"] as const,
    plans: ["subscriptions", "plans"] as const,
  },
};
