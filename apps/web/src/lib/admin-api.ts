import { apiGet, apiPatch, apiPost } from '@/lib/api';

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
