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
    quote: (leadId: string, choice: string) =>
      ["leads", "quote", leadId, choice] as const,
  },
  distribution: {
    rules: ["distribution", "rules"] as const,
    me: ["distribution", "me"] as const,
    pricingRules: ["distribution", "pricing-rules"] as const,
  },
  marketAlerts: {
    me: ["market-alerts", "me"] as const,
  },
  admin: {
    metrics: ["admin", "metrics"] as const,
    metricsBreakdown: ["admin", "metrics", "breakdown"] as const,
    audit: ["admin", "audit"] as const,
    engine: ["admin", "distribution-engine"] as const,
    refundRequests: ["admin", "refund-requests"] as const,
    resourceItems: ["admin", "resources", "items"] as const,
    leads: (opts?: { page?: number; limit?: number }) =>
      ["admin", "leads", opts ?? {}] as const,
    duplicateGroups: ["admin", "lead-duplicate-groups"] as const,
    ingestionBatches: ["admin", "ingestion", "batches"] as const,
    ingestionStats: ["admin", "ingestion", "stats"] as const,
    gradingQueue: (opts: { bucket?: string; page?: number; limit?: number }) =>
      ["admin", "grading", "queue", opts] as const,
    gradingStats: ["admin", "grading", "stats"] as const,
    gradingOverrides: ["admin", "grading", "overrides"] as const,
    integrationsHealth: ["admin", "integrations", "health"] as const,
    plans: ["admin", "subscription-plans"] as const,
    vendors: ["admin", "vendors"] as const,
    pings: ["admin", "pings"] as const,
  },
  subscriptions: {
    me: ["subscriptions", "me"] as const,
    plans: ["subscriptions", "plans"] as const,
  },
  resources: {
    items: ["resources", "items"] as const,
  },
};
