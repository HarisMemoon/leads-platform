import { apiGet, apiPatch, apiPost } from '@/lib/api';

export type MyLeadRow = {
  assignment_id: string;
  lead_id: string;
  market: string;
  type: string;
  exclusivity: string;
  charged_amount: string;
  exclusivity_choice?: 'exclusive' | 'non_exclusive';
  purchase_type: 'auto_buy' | 'manual' | 'subscription_distribution' | 'vendor_ping';
  status: string;
  ghl_sync_status: string;
  crm_sync_status: string;
  assigned_at: string;
  lifecycle_phase: string | null;
  contract_price_cents?: string | null;
  sell_price_cents?: string | null;
  buyer_notes?: string | null;
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
  // Dual-price fields (marketplace v2)
  exclusive_price_cents: string | null;
  shared_price_cents: string | null;
  max_non_exclusive_buyers: number;
  non_exclusive_buyers_count: number;
  early_access_until: string | null;
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
    exclusivity_choice?: "exclusive" | "non_exclusive";
    charged_amount: string;
    ghl_sync_status: string;
    crm_sync_status: string;
    assigned_at: string;
    buyer_id: string;
    buyer_email: string;
    lifecycle_phase?: string | null;
    disposition?: string | null;
    contract_price_cents?: string | null;
    sell_price_cents?: string | null;
    buyer_notes?: string | null;
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
  city?: string;
  state?: string;
  property_type?: string;
  timeline?: string;
  condition?: string;
  zip?: string;
  source?: 'inbound' | 'outbound';
  exclusivity?: string;
  exclusivity_filter?: 'exclusive_only' | 'non_exclusive_only' | 'both';
  minPrice?: number;
  maxPrice?: number;
  maxAgeDays?: number;
  date_from?: string;
  date_to?: string;
}) {
  const q = new URLSearchParams();
  if (params.page != null) q.set('page', String(params.page));
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.market) q.set('market', params.market);
  if (params.type) q.set('type', params.type);
  if (params.city) q.set('city', params.city);
  if (params.state) q.set('state', params.state);
  if (params.property_type) q.set('property_type', params.property_type);
  if (params.timeline) q.set('timeline', params.timeline);
  if (params.condition) q.set('condition', params.condition);
  if (params.zip) q.set('zip', params.zip);
  if (params.source) q.set('source', params.source);
  if (params.exclusivity) q.set('exclusivity', params.exclusivity);
  if (params.exclusivity_filter) q.set('exclusivity_filter', params.exclusivity_filter);
  if (params.minPrice != null) q.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) q.set('maxPrice', String(params.maxPrice));
  if (params.maxAgeDays != null) q.set('maxAgeDays', String(params.maxAgeDays));
  if (params.date_from) q.set('date_from', params.date_from);
  if (params.date_to) q.set('date_to', params.date_to);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiGet<MarketplaceListResponse>(`/leads/marketplace${suffix}`);
}

export function reserveLead(leadId: string) {
  return apiPost<ReserveLeadResponse>(`/leads/${leadId}/reserve`, {});
}

export function buyLead(leadId: string, exclusivityChoice: 'exclusive' | 'non_exclusive' = 'non_exclusive') {
  return apiPost<{ id: string }>(`/leads/${leadId}/buy`, { exclusivity_choice: exclusivityChoice });
}

export type LeadQuoteResponse = {
  exclusive_price_cents: string;
  shared_price_cents: string;
  effective_price_cents: string;
  is_pro: boolean;
  early_access_until: string | null;
  can_buy_now: boolean;
};

export function getLeadQuote(leadId: string, choice: 'exclusive' | 'non_exclusive') {
  return apiGet<LeadQuoteResponse>(`/leads/${leadId}/quote?choice=${choice}`);
}

export function getMyLeads(opts?: {
  page?: number;
  limit?: number;
  /** API: auto_buy | manual | vendor_ping (subscription_distribution when unfiltered) */
  purchaseType?: 'auto_buy' | 'manual' | 'vendor_ping';
  /** Lead status: available | sold | distributed | archived | … */
  status?: string;
  lifecyclePhase?: 'open' | 'contacted' | 'under_contract' | 'closed_won';
  /** ISO date YYYY-MM-DD */
  dateFrom?: string;
  dateTo?: string;
}) {
  const q = new URLSearchParams();
  if (opts?.page != null) q.set('page', String(opts.page));
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  if (opts?.purchaseType) q.set('purchaseType', opts.purchaseType);
  if (opts?.status) q.set('status', opts.status);
  if (opts?.lifecyclePhase) q.set('lifecyclePhase', opts.lifecyclePhase);
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
  body: {
    lifecycle_phase?: string;
    contract_price_cents?: number | null;
    sell_price_cents?: number | null;
    buyer_notes?: string | null;
  },
) {
  return apiPatch(`/leads/me/assignments/${assignmentId}/lifecycle`, body);
}

export function createRefundRequest(assignment_id: string, reason: string) {
  return apiPost<{ id: string }>('/leads/me/refund-requests', { assignment_id, reason });
}
