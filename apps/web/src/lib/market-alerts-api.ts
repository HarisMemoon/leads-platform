import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

export type MarketAlertDto = {
  id: string;
  market: string;
  filters: Record<string, unknown>;
  delivery_channels: string[];
  frequency: 'instant' | 'every_15min' | 'hourly' | 'daily';
  dnd_start: string | null;
  dnd_end: string | null;
  max_per_day: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function getMarketAlertsMe() {
  return apiGet<MarketAlertDto[]>('/market-alerts/me');
}

export function createMarketAlert(body: {
  market: string;
  filters?: Record<string, unknown>;
  delivery_channels?: string[];
  frequency: MarketAlertDto['frequency'];
  dnd_start?: string | null;
  dnd_end?: string | null;
  max_per_day?: number | null;
  is_active?: boolean;
}) {
  return apiPost<MarketAlertDto>('/market-alerts', body);
}

export function patchMarketAlert(
  id: string,
  body: Partial<{
    market: string;
    filters: Record<string, unknown>;
    delivery_channels: string[];
    frequency: MarketAlertDto['frequency'];
    dnd_start: string | null;
    dnd_end: string | null;
    max_per_day: number | null;
    is_active: boolean;
  }>,
) {
  return apiPatch<MarketAlertDto>(`/market-alerts/${id}`, body);
}

export function deleteMarketAlert(id: string) {
  return apiDelete<{ ok: boolean }>(`/market-alerts/${id}`);
}
