import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import type { ResourcesContentItem } from '@/lib/resources-api';

export type AdminExtendedMetrics = {
  countByStatus: Record<string, number>;
  totalWalletDepositsCents: string;
  totalRevenueCents: string;
  activeSubscriptions: number;
  distinctBuyers: number;
  totalAssignments: number;
};

export type AuditLogRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  actor?: { id: string; email: string } | null;
};

export type DistributionEngineSettingsDto = {
  id: string;
  queue_paused: boolean;
  max_auto_distribution_runs: number;
  cooldown_minutes_between_runs: number;
  markdown_after_days: number;
  markdown_percent: number;
  created_at: string;
  updated_at: string;
};

export function getAdminExtendedMetrics() {
  return apiGet<AdminExtendedMetrics>('/admin/metrics/extended');
}

export function postAdminWalletCredit(body: {
  user_id: string;
  amount_cents: number;
  description: string;
}) {
  return apiPost<{ ok: boolean }>('/admin/wallet/credit', body);
}

export function getAdminAuditLogs() {
  return apiGet<AuditLogRow[]>('/admin/audit-logs');
}

export function getDistributionEngineSettings() {
  return apiGet<DistributionEngineSettingsDto>(
    '/admin/distribution-engine/settings',
  );
}

export function getAdminLeads(opts?: { page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (opts?.page != null) q.set('page', String(opts.page));
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiGet<{
    items: Array<{
      id: string;
      title: string;
      market: string;
      lead_type: string;
      status: string;
      price_cents: string;
      created_at: string;
    }>;
    pagination: { page: number; limit: number; total: number };
  }>(`/admin/leads${suffix}`);
}

export type AdminMetricsBreakdown = {
  topBuyers: Array<{
    user_id: string;
    email: string;
    total_spend_cents: string;
    assignment_count: number;
  }>;
  soldByType: Array<{
    lead_type: string;
    assignment_count: number;
    revenue_cents: string;
  }>;
  deliverySuccessRate: number;
  contactRate: number;
  mrrEstimateCents: string;
  subscriptionChurn30d: {
    cancelled: number;
    activeAtPeriodStart: number;
    churnRate: number;
  };
  pendingRefundCreditsCents: string;
  duplicateAutoMergedLast7d: number;
  gradingBuckets: { high: number; borderline: number; below: number };
  manualOverridesLast7d: number;
};

export function getAdminMetricsBreakdown() {
  return apiGet<AdminMetricsBreakdown>('/admin/metrics/breakdown');
}

export type AdminLeadDuplicateGroup = {
  phone: string;
  ids: string[];
  count: string;
};

export function getAdminLeadDuplicateGroups() {
  return apiGet<AdminLeadDuplicateGroup[]>('/admin/lead-duplicate-groups');
}

export function postAdminLeadMarkDuplicate(
  duplicateLeadId: string,
  canonicalLeadId: string,
) {
  return apiPost<{ id: string }>(
    `/admin/leads/${duplicateLeadId}/mark-duplicate`,
    { canonical_lead_id: canonicalLeadId },
  );
}

export type IngestionBatchRow = {
  id: string;
  filename: string;
  vendor: string | null;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  error_message: string | null;
  failure_samples: Array<{ row: number; reason: string }>;
  uploaded_by: { id: string; email: string } | null;
  created_at: string;
  processed_at: string | null;
};

export type IngestionStats = {
  pendingReview: number;
  processedLast24h: number;
  failedBatches: number;
};

export function getAdminIngestionBatches(limit = 25) {
  return apiGet<IngestionBatchRow[]>(`/admin/ingestion/batches?limit=${limit}`);
}

export function getAdminIngestionStats() {
  return apiGet<IngestionStats>('/admin/ingestion/stats');
}

export type IngestionRowInput = {
  market: string;
  lead_type: string;
  contact_email?: string;
  contact_phone?: string;
  title?: string;
  source?: string;
  quality_score?: number;
  price_cents: number;
};

export function postAdminIngestionBatch(body: {
  filename: string;
  vendor?: string;
  rows: IngestionRowInput[];
}) {
  return apiPost<IngestionBatchRow>('/admin/ingestion/batches', body);
}

export type GradingQueueItem = {
  id: string;
  title: string;
  market: string;
  lead_type: string;
  status: string;
  quality_score: number;
  price_cents: string;
  created_at: string;
};

export type GradingQueueResponse = {
  items: GradingQueueItem[];
  pagination: { page: number; limit: number; total: number };
};

export type GradingStats = {
  buckets: { high: number; borderline: number; below: number };
  manualOverridesLastWindowDays: number;
  manualOverridesCount: number;
};

export type GradingOverrideRow = {
  id: string;
  lead: { id: string; title: string } | null;
  original_score: number;
  override_score: number;
  notes: string | null;
  reviewer: { id: string; email: string } | null;
  created_at: string;
};

export function getAdminGradingQueue(opts: {
  bucket?: 'high' | 'borderline' | 'below';
  page?: number;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (opts.bucket) q.set('bucket', opts.bucket);
  if (opts.page != null) q.set('page', String(opts.page));
  if (opts.limit != null) q.set('limit', String(opts.limit));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiGet<GradingQueueResponse>(`/admin/grading/queue${suffix}`);
}

export function getAdminGradingStats() {
  return apiGet<GradingStats>('/admin/grading/stats');
}

export function getAdminGradingOverrides(limit = 50) {
  return apiGet<GradingOverrideRow[]>(`/admin/grading/overrides?limit=${limit}`);
}

export function postAdminGradingOverride(body: {
  lead_id: string;
  override_score: number;
  notes?: string;
}) {
  return apiPost<{
    id: string;
    lead_id: string;
    original_score: number;
    override_score: number;
    created_at: string;
  }>('/admin/grading/overrides', body);
}

export type IntegrationHealthRow = {
  name: string;
  status: 'ok' | 'warn' | 'down' | 'unconfigured';
  note: string;
  last_checked_at: string;
  latency_ms: number | null;
};

export function getAdminIntegrationsHealth() {
  return apiGet<IntegrationHealthRow[]>('/admin/integrations/health');
}

export type AdminSubscriptionPlan = {
  plan_type: 'basic' | 'pro' | 'market_specific' | 'premium';
  name: string;
  tagline: string;
  monthly_price_cents: string;
  display_price: string;
  billing_period_label: string;
  monthly_lead_limit: number | null;
  lead_limit_summary: string;
  priority_rank: number;
  priority_label: string;
  distribution_summary: string;
  included_lead_credits_summary: string | null;
  filter_scope: {
    state?: boolean;
    county?: boolean;
    zip?: boolean;
    leadType?: boolean;
  };
  card_highlights: string[];
  feature_bullets: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function getAdminSubscriptionPlans() {
  return apiGet<AdminSubscriptionPlan[]>('/admin/subscriptions/plans');
}

export function patchAdminSubscriptionPlan(
  planType: AdminSubscriptionPlan['plan_type'],
  body: Partial<{
    name: string;
    tagline: string;
    monthly_price_cents: number;
    display_price: string;
    billing_period_label: string;
    monthly_lead_limit: number | null;
    lead_limit_summary: string;
    priority_rank: number;
    priority_label: string;
    distribution_summary: string;
    included_lead_credits_summary: string | null;
    filter_scope: AdminSubscriptionPlan['filter_scope'];
    card_highlights: string[];
    feature_bullets: string[];
    is_active: boolean;
  }>,
) {
  return apiPatch<AdminSubscriptionPlan>(
    `/admin/subscriptions/plans/${planType}`,
    body,
  );
}

export function patchDistributionEngineSettings(
  body: Partial<{
    queue_paused: boolean;
    max_auto_distribution_runs: number;
    cooldown_minutes_between_runs: number;
    markdown_after_days: number;
    markdown_percent: number;
  }>,
) {
  return apiPatch<DistributionEngineSettingsDto>(
    '/admin/distribution-engine/settings',
    body,
  );
}

export function patchAdminUserDistributionLock(
  userId: string,
  body: { locked: boolean },
) {
  return apiPatch<{ ok: boolean; distribution_locked: boolean }>(
    `/admin/users/${userId}/distribution-lock`,
    body,
  );
}

export type AdminRefundRequestRow = {
  id: string;
  status: string;
  reason: string;
  admin_notes: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  buyer: { id: string; email: string };
  lead_assignment: {
    id: string;
    purchase_type: string;
    amount_charged_cents: string;
    lead: { id: string; title: string; market: string };
  };
};

export function getAdminRefundRequests() {
  return apiGet<AdminRefundRequestRow[]>('/admin/refund-requests');
}

export function patchAdminRefundRequest(
  id: string,
  body: {
    status: 'approved' | 'rejected';
    admin_notes?: string;
    resolution?: 'wallet_credit' | 'premium_credit';
  },
) {
  return apiPatch<AdminRefundRequestRow>(`/admin/refund-requests/${id}`, body);
}

export function getAdminResourceItems() {
  return apiGet<ResourcesContentItem[]>('/admin/resources/items');
}

export function postAdminResourceItem(body: {
  kind: string;
  title: string;
  body?: string | null;
  url?: string | null;
  sort_order?: number;
  is_published?: boolean;
}) {
  return apiPost<ResourcesContentItem>('/admin/resources/items', body);
}

export function patchAdminResourceItem(
  id: string,
  body: Partial<{
    kind: string;
    title: string;
    body: string | null;
    url: string | null;
    sort_order: number;
    is_published: boolean;
  }>,
) {
  return apiPatch<ResourcesContentItem>(`/admin/resources/items/${id}`, body);
}

export function deleteAdminResourceItem(id: string) {
  return apiDelete<{ ok: boolean }>(`/admin/resources/items/${id}`);
}
