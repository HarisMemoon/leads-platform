import { apiGet, apiPatch } from '@/lib/api';

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
