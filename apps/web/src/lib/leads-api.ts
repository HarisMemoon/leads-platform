import { apiGet, apiPatch, apiPost } from '@/lib/api';

export type MyLeadRow = {
  assignment_id: string;
  lead_id: string;
  market: string;
  type: string;
  exclusivity: string;
  charged_amount: string;
  purchase_type: 'auto_buy' | 'manual' | 'subscription_distribution';
  status: string;
  ghl_sync_status: string;
  crm_sync_status: string;
  assigned_at: string;
  lifecycle_phase: string | null;
};

export type MyLeadsResponse = {
  items: MyLeadRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

export type MarketplaceLeadRow = {
  id: string;
  title: string;
  market: string;
  type: string;
  exclusivity: string;
  quality_score: number;
  current_price: string;
  list_price_anchor_cents: string | null;
  marketplace_tier: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type MarketplaceListResponse = {
  items: MarketplaceLeadRow[];
  pagination: { page: number; limit: number; total: number };
};

export type LeadDetailResponse = {
  lead: {
    id: string;
    source: string;
    market: string;
    type: string;
    exclusivity: string;
    quality_score: number;
    current_price: string;
    list_price_anchor_cents?: string | null;
    marketplace_tier?: string | null;
    title: string;
    status: string;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  lead_price_history: Array<{
    id: string;
    old_price_cents: string;
    new_price_cents: string;
    reason: string;
    changed_at: string;
  }>;
  lead_assignments: Array<{
    assignment_id: string;
    purchase_type: string;
    charged_amount: string;
    ghl_sync_status: string;
    crm_sync_status: string;
    assigned_at: string;
    buyer_id: string;
    buyer_email: string;
    lifecycle_phase?: string | null;
    disposition?: string | null;
    timeline?: Array<{
      id: string;
      event_type: string;
      body: Record<string, unknown>;
      created_at: string;
    }>;
  }>;
};

export type ReserveLeadResponse = {
  reserved_until: string;
  ttl_seconds: number;
};

export function listMarketplaceLeads(params: {
  page?: number;
  limit?: number;
  market?: string;
  type?: string;
  exclusivity?: string;
  minPrice?: number;
  maxPrice?: number;
  maxAgeDays?: number;
  marketplaceTier?: string;
}) {
  const q = new URLSearchParams();
  if (params.page != null) q.set('page', String(params.page));
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.market) q.set('market', params.market);
  if (params.type) q.set('type', params.type);
  if (params.exclusivity) q.set('exclusivity', params.exclusivity);
  if (params.minPrice != null) q.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) q.set('maxPrice', String(params.maxPrice));
  if (params.maxAgeDays != null) q.set('maxAgeDays', String(params.maxAgeDays));
  if (params.marketplaceTier) q.set('marketplaceTier', params.marketplaceTier);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiGet<MarketplaceListResponse>(`/leads/marketplace${suffix}`);
}

export function reserveLead(leadId: string) {
  return apiPost<ReserveLeadResponse>(`/leads/${leadId}/reserve`, {});
}

export function buyLead(leadId: string) {
  return apiPost<{ id: string }>(`/leads/${leadId}/buy`, {});
}

export function getMyLeads(opts?: {
  page?: number;
  limit?: number;
  /** API: auto_buy | manual (subscription_distribution when unfiltered) */
  purchaseType?: 'auto_buy' | 'manual';
  /** Lead status: available | sold | distributed | archived | … */
  status?: string;
  /** ISO date YYYY-MM-DD */
  dateFrom?: string;
  dateTo?: string;
}) {
  const q = new URLSearchParams();
  if (opts?.page != null) q.set('page', String(opts.page));
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  if (opts?.purchaseType) q.set('purchaseType', opts.purchaseType);
  if (opts?.status) q.set('status', opts.status);
  if (opts?.dateFrom) q.set('dateFrom', opts.dateFrom);
  if (opts?.dateTo) q.set('dateTo', opts.dateTo);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiGet<MyLeadsResponse>(`/leads/me${suffix}`);
}

export function getLeadDetail(leadId: string) {
  return apiGet<LeadDetailResponse>(`/leads/${leadId}`);
}

export function patchAssignmentLifecycle(
  assignmentId: string,
  lifecycle_phase: string,
) {
  return apiPatch(`/leads/me/assignments/${assignmentId}/lifecycle`, {
    lifecycle_phase,
  });
}
