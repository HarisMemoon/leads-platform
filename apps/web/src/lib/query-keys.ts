/** Centralized TanStack Query keys for cache invalidation. */
export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  wallet: {
    me: ["wallet", "me"] as const,
    transactions: (opts?: { limit?: number; offset?: number }) =>
      ["wallet", "transactions", opts ?? {}] as const,
  },
  onboarding: {
    me: ["onboarding", "me"] as const,
  },
  dashboard: {
    summary: ["dashboard", "summary"] as const,
  },
};
