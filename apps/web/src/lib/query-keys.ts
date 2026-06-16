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
    launchChecklist: ["distribution", "launch-checklist"] as const,
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
    leads: (opts?: { page?: number; limit?: number; source?: string; date_from?: string }) =>
      ["admin", "leads", opts ?? {}] as const,
    metricsIntake: (period: string) => ["admin", "metrics", "intake", period] as const,
    vendorWebhookHits: (vendorId: string) => ["admin", "vendors", vendorId, "webhook-hits"] as const,
    vendorPayoutStats: (vendorId: string) => ["admin", "vendors", vendorId, "payout-stats"] as const,
    duplicateGroups: ["admin", "lead-duplicate-groups"] as const,
    ingestionBatches: ["admin", "ingestion", "batches"] as const,
    ingestionStats: ["admin", "ingestion", "stats"] as const,
    pendingLeads: ["admin", "leads", "pending"] as const,
    gradingQueue: (opts: { bucket?: string; page?: number; limit?: number }) =>
      ["admin", "grading", "queue", opts] as const,
    gradingStats: ["admin", "grading", "stats"] as const,
    gradingOverrides: ["admin", "grading", "overrides"] as const,
    integrationsHealth: ["admin", "integrations", "health"] as const,
    plans: ["admin", "subscription-plans"] as const,
    vendors: ["admin", "vendors"] as const,
    pings: ["admin", "pings"] as const,
    outboundBuyers: ["admin", "outbound", "buyers"] as const,
    outboundLogs: (opts?: { leadId?: string }) => ["admin", "outbound", "logs", opts ?? {}] as const,
    leadPricing: ["admin", "lead-pricing"] as const,
    vendorStats: (sort?: string) => ["admin", "vendor-stats", sort ?? "newest"] as const,
    vendorDetail: (id: string) => ["admin", "vendor-detail", id] as const,
  },
  subscriptions: {
    me: ["subscriptions", "me"] as const,
    plans: ["subscriptions", "plans"] as const,
  },
  terms: {
    status: ["terms", "status"] as const,
  },
  resources: {
    items: ["resources", "items"] as const,
  },
};
