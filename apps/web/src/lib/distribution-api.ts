import { apiDelete, apiGet, apiPatch } from '@/lib/api';

export type ExclusivityPreference = 'exclusive' | 'non_exclusive' | 'both';

export type DistributionRuleDto = {
  id: string;
  participation_enabled: boolean;
  max_per_day: number;
  market: string;
  market_filters: string[];
  is_active: boolean;
  max_leads_per_day: number | null;
  max_leads_per_week: number | null;
  max_leads_per_month: number | null;
  max_spend_per_day_cents: string | null;
  max_spend_per_week_cents: string | null;
  max_spend_per_month_cents: string | null;
  min_wallet_balance_cents: string;
  lead_type_filters: string[];
  cooldown_minutes: number;
  rotation_position: number;
  exclusivity_preference: ExclusivityPreference;
  max_lead_price_cents: string | null;
  created_at: string;
  updated_at: string;
};

export type PatchDistributionBody = Partial<{
  participation_enabled: boolean;
  max_per_day: number;
  max_leads_per_day: number | null;
  max_leads_per_week: number | null;
  max_leads_per_month: number | null;
  max_spend_per_day_cents: number | null;
  max_spend_per_week_cents: number | null;
  max_spend_per_month_cents: number | null;
  min_wallet_balance_cents: number;
  lead_type_filters: string[];
  cooldown_minutes: number;
  rotation_position: number;
  market_filters: string[];
  is_active: boolean;
  exclusivity_preference: ExclusivityPreference;
  max_lead_price_cents: number | null;
}>;

export function getDistributionRulesMe() {
  return apiGet<DistributionRuleDto[]>('/distribution/rules/me');
}

export function patchDistributionRule(id: string, body: PatchDistributionBody) {
  return apiPatch<DistributionRuleDto>(`/distribution/rules/${id}`, body);
}

/** Single-rule "me" endpoints — GET /distribution/me, PATCH /distribution/me */
export function getDistributionMe() {
  return apiGet<DistributionRuleDto>('/distribution/me');
}

export function patchDistributionMe(body: PatchDistributionBody) {
  return apiPatch<DistributionRuleDto>('/distribution/me', body);
}

export type BuyerPricingRuleDto = {
  id: string;
  name: string;
  is_active: boolean;
  paused: boolean;
  priority: number;
  markets: string[];
  states: string[];
  cities: string[];
  zips: string[];
  counties: string[];
  property_types: string[];
  lead_types: string[];
  fixed_price_cents: string | null;
  max_bid_cents: string | null;
  exclusivity_preference: 'exclusive_only' | 'non_exclusive_only' | 'both';
  routing_strategy: 'highest_bid' | 'priority' | 'round_robin';
  created_at: string;
  updated_at: string;
};

export type UpsertBuyerPricingRuleBody = Partial<{
  id: string;
  name: string;
  is_active: boolean;
  paused: boolean;
  priority: number;
  markets: string[];
  states: string[];
  cities: string[];
  zips: string[];
  counties: string[];
  property_types: string[];
  lead_types: string[];
  fixed_price_cents: number | null;
  max_bid_cents: number | null;
  exclusivity_preference: 'exclusive_only' | 'non_exclusive_only' | 'both';
  routing_strategy: 'highest_bid' | 'priority' | 'round_robin';
}> & { name: string };

export function getBuyerPricingRulesMe() {
  return apiGet<BuyerPricingRuleDto[]>('/distribution/pricing-rules/me');
}

export function upsertBuyerPricingRule(body: UpsertBuyerPricingRuleBody) {
  return apiPatch<BuyerPricingRuleDto>('/distribution/pricing-rules/me', body);
}

export function deleteBuyerPricingRule(id: string) {
  return apiDelete<{ ok: boolean }>(`/distribution/pricing-rules/${id}`);
}
