import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import type { ResourcesContentItem } from '@/lib/resources-api';

export type AdminExtendedMetrics = {
  countByStatus: Record<string, number>;
  totalWalletDepositsCents: string;
  totalRevenueCents: string;
  activeSubscriptions: number;
  distinctBuyers: number;
  totalAssignments: number;
  /** Leads currently on the marketplace (AVAILABLE) — primary input to auto-distribution. */
  availableLeads?: number;
  /** Distribution rules with participation on and rule active — buyers in the auto-buy pool. */
  autoDistributionParticipants?: number;
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
  early_access_minutes: number;
  created_at: string;
  updated_at: string;
};

export type AdminLeadPricingConfigDto = {
  id: string;
  lead_type: string;
  new_lead_price_cents: string;
  shared_price_cents: string | null;
  discount_after_days: number;
  discount_amount_cents: string;
  min_price_floor_cents: string | null;
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

export function getAdminLeadPricing() {
  return apiGet<AdminLeadPricingConfigDto[]>('/admin/lead-pricing');
}

export function patchAdminLeadPricing(
  type: string,
  body: Partial<{
    new_lead_price_cents: number;
    shared_price_cents: number | null;
    discount_after_days: number;
    discount_amount_cents: number;
    min_price_floor_cents: number | null;
  }>,
) {
  return apiPatch<AdminLeadPricingConfigDto>(`/admin/lead-pricing/${type}`, body);
}

export type VendorIntegrationDto = {
  id: string;
  name: string;
  enabled: boolean;
  allowed_sources: string[];
  ping_timeout_ms: number;
  ping_ttl_seconds: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function getAdminVendors() {
  return apiGet<VendorIntegrationDto[]>('/admin/vendors');
}

export function postAdminVendor(body: {
  name: string;
  api_key: string;
  enabled?: boolean;
  allowed_sources?: string[];
  ping_timeout_ms?: number;
  ping_ttl_seconds?: number;
}) {
  return apiPost<VendorIntegrationDto>('/admin/vendors', body);
}

export function patchAdminVendor(
  id: string,
  body: Partial<{
    name: string;
    api_key: string;
    enabled: boolean;
    allowed_sources: string[];
    ping_timeout_ms: number;
    ping_ttl_seconds: number;
  }>,
) {
  return apiPatch<VendorIntegrationDto>(`/admin/vendors/${id}`, body);
}

export type AdminPingRow = {
  id: string;
  vendor_ping_id: string;
  status: string;
  market: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lead_type: string;
  source: string | null;
  matched_price_cents: string | null;
  rejection_reason: string | null;
  latency_ms: number | null;
  expires_at: string | null;
  created_at: string;
  vendor?: { id: string; name: string } | null;
  matched_buyer?: { id: string; email: string } | null;
  matched_pricing_rule?: { id: string; name: string } | null;
};

export type AdminPingDetail = {
  ping: AdminPingRow;
  audit: Array<{
    id: string;
    eligible: boolean;
    price_cents: string | null;
    ranking_score: number;
    rejection_reason: string | null;
    details: Record<string, unknown>;
    created_at: string;
    buyer?: { id: string; email: string } | null;
    pricing_rule?: { id: string; name: string } | null;
  }>;
};

export function getAdminPings(limit = 50) {
  return apiGet<AdminPingRow[]>(`/admin/pings?limit=${limit}`);
}

export function getAdminPing(id: string) {
  return apiGet<AdminPingDetail>(`/admin/pings/${id}`);
}

export type AdminLeadRow = {
  id: string;
  title: string;
  market: string;
  lead_type: string;
  status: string;
  source: string;
  canonical_lead_source: string | null;
  price_cents: string;
  exclusive_price_cents: string | null;
  shared_price_cents: string | null;
  max_non_exclusive_buyers: number;
  non_exclusive_buyers_count: number;
  early_access_until: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  buyers: string[];
  // Internal cost fields (admin only)
  internal_cost_cents: string | null;
  ping_post_cost_cents: string | null;
  campaign_name: string | null;
  ad_source: string | null;
  cost_notes: string | null;
};

export type IntakePeriodStats = {
  leads_in: number;
  leads_sold: number;
  revenue_cents: string;
  period_start: string;
};

export type AdminVendorWebhookHit = {
  id: string;
  vendor_id: string | null;
  lead_id: string | null;
  status: 'accepted' | 'rejected';
  rejection_reason: string | null;
  ip_address: string | null;
  payload_snapshot: Record<string, unknown>;
  created_at: string;
};

export type AdminVendorPayoutStats = {
  vendor_id: string;
  vendor_name: string;
  total_hits: number;
  accepted: number;
  rejected: number;
};

export type AdminVendorStatsRow = {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
  total_hits: number;
  accepted_hits: number;
  total_leads: number;
  purchased_leads: number;
  total_revenue_cents: number;
  conversion_rate: number;
};

export type AdminVendorDetail = {
  vendor: VendorIntegrationDto;
  summary: {
    total_leads: number;
    purchased_leads: number;
    total_revenue_cents: number;
    avg_revenue_per_lead: number;
    conversion_rate: number;
  };
  webhook_hits: {
    total: number;
    accepted: number;
    rejected: number;
  };
  recent_leads: Array<{
    lead_id: string;
    title: string;
    market: string;
    created_at: string;
    purchase_count: number;
    revenue_cents: number;
  }>;
};

export function getAdminLeads(opts?: {
  page?: number;
  limit?: number;
  source?: 'inbound' | 'outbound';
  date_from?: string;
}) {
  const q = new URLSearchParams();
  if (opts?.page != null) q.set('page', String(opts.page));
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  if (opts?.source) q.set('source', opts.source);
  if (opts?.date_from) q.set('date_from', opts.date_from);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiGet<{
    items: AdminLeadRow[];
    pagination: { page: number; limit: number; total: number };
  }>(`/admin/leads${suffix}`);
}

export function deleteAdminLead(id: string) {
  return apiDelete<{ ok: boolean; archived: boolean }>(`/admin/leads/${id}`);
}

export function patchAdminLead(
  id: string,
  body: Partial<{
    title: string;
    market: string;
    lead_type: string;
    status: string;
    source: string;
    metadata: Record<string, unknown>;
    exclusive_price_cents: number;
    shared_price_cents: number;
    max_non_exclusive_buyers: number;
    price_cents: number;
  }>,
) {
  return apiPatch<AdminLeadRow>(`/admin/leads/${id}`, body);
}

export function getAdminMetricsIntake(period: 'today' | 'week' | 'month' = 'today') {
  return apiGet<IntakePeriodStats>(`/admin/metrics/intake?period=${period}`);
}

export function getAdminVendorWebhookHits(vendorId: string, limit = 50) {
  return apiGet<AdminVendorWebhookHit[]>(
    `/admin/vendors/${vendorId}/webhook-hits?limit=${limit}`,
  );
}

export function getAdminVendorPayoutStats(vendorId: string) {
  return apiGet<AdminVendorPayoutStats>(`/admin/vendors/${vendorId}/payout-stats`);
}

export function getAdminVendorStats(sort?: "newest" | "latest" | "leads" | "sold" | "revenue") {
  const suffix = sort ? `?sort=${encodeURIComponent(sort)}` : "";
  return apiGet<AdminVendorStatsRow[]>(`/admin/vendors/stats${suffix}`);
}

export function getAdminVendorDetail(vendorId: string) {
  return apiGet<AdminVendorDetail>(`/admin/vendors/${vendorId}/stats`);
}

export function postAdminLeadDiscount(
  id: string,
  body: { percent: number; until?: string },
) {
  return apiPost<{ ok: boolean }>(`/admin/leads/${id}/discount`, body);
}

export function postAdminLeadBoost(
  id: string,
  body: { percent: number },
) {
  return apiPost<{ ok: boolean }>(`/admin/leads/${id}/boost`, body);
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

export function lookupAdminUserByEmail(email: string) {
  return apiGet<{ id: string; email: string; full_name: string | null; created_at: string }>(
    `/admin/users/lookup?email=${encodeURIComponent(email)}`,
  );
}

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  distribution_locked: boolean;
  email_verified: boolean;
  onboarding_completed: boolean;
  account_status?: string;
  created_at: string;
};

export function getAdminUsers(params?: {
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  if (params?.dateFrom) q.set('date_from', params.dateFrom);
  if (params?.dateTo) q.set('date_to', params.dateTo);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiGet<{ users: AdminUserRow[]; total: number }>(`/admin/users${suffix}`);
}

export function patchAdminUserActive(userId: string, isActive: boolean) {
  return apiPatch<{ id: string; email: string; is_active: boolean }>(
    `/admin/users/${userId}/active`,
    { is_active: isActive },
  );
}

export type AdminLeadDuplicateGroup = {
  phone: string;
  count: string;
  leads: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    is_duplicate: boolean;
  }>;
};

export function getAdminLeadDuplicateGroups() {
  return apiGet<AdminLeadDuplicateGroup[]>('/admin/lead-duplicate-groups');
}

export type AdminResolvedDuplicateGroup = {
  canonical_id: string;
  canonical_title: string;
  phone: string;
  duplicate_count: string;
  duplicates: Array<{ id: string; title: string; created_at: string }>;
};

export function getAdminResolvedDuplicateGroups(params?: {
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  if (params?.dateFrom) q.set('date_from', params.dateFrom);
  if (params?.dateTo) q.set('date_to', params.dateTo);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiGet<AdminResolvedDuplicateGroup[]>(`/admin/lead-duplicate-groups/resolved${suffix}`);
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
  price_cents: number;
  exclusivity_level?: 'exclusive' | 'non_exclusive';
  title?: string;
  source?: string;
  quality_score?: number;
  // contact
  seller_name?: string;
  first_name?: string;
  last_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  // location
  city?: string;
  state?: string;
  zip?: string;
  // property
  property_type?: string;
  condition?: string;
  timeline?: string;
  notes?: string;
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

export type AdminPlanFeatureBullet = { text: string; visible: boolean };

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
  feature_bullets: AdminPlanFeatureBullet[];
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
    feature_bullets: AdminPlanFeatureBullet[];
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
    early_access_minutes: number;
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

export function postAdminPauseDelivery(userId: string) {
  return apiPost<{ ok: boolean; userId: string; delivery_paused: boolean }>(
    `/admin/users/${userId}/pause-delivery`,
    {},
  );
}

export function postAdminResumeDelivery(userId: string) {
  return apiPost<{ ok: boolean; userId: string; delivery_paused: boolean }>(
    `/admin/users/${userId}/resume-delivery`,
    {},
  );
}

export function postAdminAssignLead(leadId: string, userId: string) {
  return apiPost<{ ok: boolean; assignment_id: string }>(`/admin/leads/${leadId}/assign`, { user_id: userId });
}

export function deleteAdminAssignment(assignmentId: string) {
  return apiDelete<{ ok: boolean }>(`/admin/assignments/${assignmentId}`);
}

export function postAdminReplaceAssignment(
  assignmentId: string,
  newLeadId: string,
) {
  return apiPost<{
    ok: boolean;
    revoked_assignment_id: string;
    new_assignment?: { id: string } | null;
  }>(`/admin/assignments/${assignmentId}/replace`, { new_lead_id: newLeadId });
}

export function postAdminMarkLeadBad(leadId: string, reason?: string) {
  return apiPost<{ ok: boolean; id: string }>(`/admin/leads/${leadId}/mark-bad`, { reason });
}

export function patchAdminLeadInternalCost(
  id: string,
  body: {
    internal_cost_cents?: number | null;
    ping_post_cost_cents?: number | null;
    campaign_name?: string | null;
    ad_source?: string | null;
    cost_notes?: string | null;
  },
) {
  return apiPatch<{
    id: string;
    internal_cost_cents: string | null;
    ping_post_cost_cents: string | null;
    campaign_name: string | null;
    ad_source: string | null;
    cost_notes: string | null;
  }>(`/admin/leads/${id}/internal-cost`, body);
}

export type RefundAbuseStats = {
  total_purchases: number;
  total_refund_requests: number;
  approved: number;
  denied: number;
  pending: number;
  abuse_review: number;
  refund_rate_pct: number;
  flagged: boolean;
};

export function getAdminRefundAbuseStats(userId: string) {
  return apiGet<RefundAbuseStats>(`/admin/users/${userId}/refund-abuse-stats`);
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

// ── Outbound buyer endpoints (ping/post to external buyers) ───────────────

export type OutboundBuyerEndpointDto = {
  id: string;
  name: string;
  ping_url: string;
  post_url: string | null;
  auth_header_name: string | null;
  auth_header_value: string | null;
  field_map: Record<string, string>;
  static_fields: Record<string, unknown>;
  price_floor_cents: string;
  timeout_ms: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OutboundPingLogRow = {
  id: string;
  lead_id: string | null;
  buyer_endpoint_id: string;
  status: 'accepted' | 'declined' | 'timeout' | 'error' | 'below_floor' | 'posted';
  bid_price_cents: string | null;
  floor_price_cents: string;
  response_payload: Record<string, unknown> | null;
  latency_ms: number | null;
  error_message: string | null;
  is_test: boolean;
  created_at: string;
};

export type TestPingResult = {
  log_id: string;
  status: string;
  bid_price_cents: number | null;
  latency_ms: number;
  response: Record<string, unknown> | null;
  error: string | null;
};

export function getAdminOutboundBuyers() {
  return apiGet<OutboundBuyerEndpointDto[]>('/admin/outbound/buyers');
}

export function postAdminOutboundBuyer(body: {
  name: string;
  ping_url: string;
  post_url?: string | null;
  auth_header_name?: string | null;
  auth_header_value?: string | null;
  field_map?: Record<string, string>;
  static_fields?: Record<string, unknown>;
  price_floor_cents?: number;
  timeout_ms?: number;
  is_active?: boolean;
}) {
  return apiPost<OutboundBuyerEndpointDto>('/admin/outbound/buyers', body);
}

export function patchAdminOutboundBuyer(
  id: string,
  body: Partial<{
    name: string;
    ping_url: string;
    post_url: string | null;
    auth_header_name: string | null;
    auth_header_value: string | null;
    field_map: Record<string, string>;
    static_fields: Record<string, unknown>;
    price_floor_cents: number;
    timeout_ms: number;
    is_active: boolean;
  }>,
) {
  return apiPatch<OutboundBuyerEndpointDto>(`/admin/outbound/buyers/${id}`, body);
}

export function deleteAdminOutboundBuyer(id: string) {
  return apiDelete<{ ok: boolean }>(`/admin/outbound/buyers/${id}`);
}

export function postAdminOutboundBuyerTestPing(id: string) {
  return apiPost<TestPingResult>(`/admin/outbound/buyers/${id}/test-ping`, {});
}

export function getAdminOutboundPingLogs(limit = 50, leadId?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (leadId) params.set('lead_id', leadId);
  return apiGet<OutboundPingLogRow[]>(`/admin/outbound/logs?${params}`);
}

export function postAdminTriggerOutboundPing(leadId: string) {
  return apiPost<{ sold: boolean; buyerName?: string; priceCents?: number; attempts: number }>(
    `/admin/leads/${leadId}/ping-outbound`,
    {},
  );
}

// ── Pending leads (inbound review queue) ──────────────────────────────────

export type PendingLeadRow = {
  id: string;
  title: string;
  market: string;
  lead_type: string;
  price_cents: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PendingLeadGroup = {
  vendor_id: string | null;
  vendor_name: string;
  count: number;
  leads: PendingLeadRow[];
};

export type PendingLeadsResponse = {
  groups: PendingLeadGroup[];
  total: number;
};

export function getAdminPendingLeads() {
  return apiGet<PendingLeadsResponse>('/admin/leads/pending');
}

export function patchAdminApproveLead(id: string) {
  return apiPatch<{ ok: boolean; id: string; status: string }>(`/admin/leads/${id}/approve`, {});
}

export function patchAdminRejectLead(id: string) {
  return apiPatch<{ ok: boolean; id: string; status: string }>(`/admin/leads/${id}/reject`, {});
}

export function postAdminBulkApproveLeads(ids: string[]) {
  return apiPost<{ ok: boolean; approved: number }>('/admin/leads/bulk-approve', { ids });
}

export function postAdminBulkRejectLeads(ids: string[]) {
  return apiPost<{ ok: boolean; rejected: number }>('/admin/leads/bulk-reject', { ids });
}
