import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GhlOutboundService {
  private readonly logger = new Logger(GhlOutboundService.name);

  constructor(private readonly config: ConfigService) {}

  async emit(event: string, payload: Record<string, unknown>): Promise<void> {
    await this.emitWithStatus(event, payload);
  }

  async emitWithStatus(
    event: string,
    payload: Record<string, unknown>,
  ): Promise<{ delivered: boolean; skipped: boolean; status: number | null }> {
    const url = (this.config.get<string>('ADMIN_OUTBOUND_WEBHOOK_URL') ?? '').trim();
    if (!url) {
      return { delivered: false, skipped: true, status: null };
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, ...payload, emitted_at: new Date().toISOString() }),
      });
      if (!res.ok) {
        this.logger.warn(`Outbound webhook failed (${event}) with HTTP ${res.status}`);
      }
      return { delivered: res.ok, skipped: false, status: res.status };
    } catch (e) {
      this.logger.warn(
        `Outbound webhook failed (${event}): ${e instanceof Error ? e.message : e}`,
      );
      return { delivered: false, skipped: false, status: null };
    }
  }
}
