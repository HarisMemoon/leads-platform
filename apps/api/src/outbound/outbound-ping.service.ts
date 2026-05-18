import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboundBuyerEndpoint } from '../entities/outbound-buyer-endpoint.entity';
import { OutboundPingLog, OutboundPingStatus } from '../entities/outbound-ping-log.entity';
import { Lead } from '../entities/lead.entity';
import { CreateOutboundBuyerDto, PatchOutboundBuyerDto } from './dto/outbound-buyer.dto';

type PingAttempt = {
  endpoint: OutboundBuyerEndpoint;
  status: OutboundPingStatus;
  bidCents: number | null;
  latencyMs: number;
  responsePayload: Record<string, unknown> | null;
  errorMessage: string | null;
};

export type OutboundPingResult = {
  sold: boolean;
  buyerName?: string;
  priceCents?: number;
  attempts: number;
};

@Injectable()
export class OutboundPingService {
  private readonly logger = new Logger(OutboundPingService.name);

  constructor(
    @InjectRepository(OutboundBuyerEndpoint)
    private readonly endpointRepo: Repository<OutboundBuyerEndpoint>,
    @InjectRepository(OutboundPingLog)
    private readonly logRepo: Repository<OutboundPingLog>,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  listEndpoints() {
    return this.endpointRepo.find({ order: { created_at: 'DESC' } });
  }

  createEndpoint(dto: CreateOutboundBuyerDto) {
    return this.endpointRepo.save(
      this.endpointRepo.create({
        name: dto.name,
        ping_url: dto.ping_url,
        post_url: dto.post_url ?? null,
        auth_header_name: dto.auth_header_name ?? null,
        auth_header_value: dto.auth_header_value ?? null,
        field_map: dto.field_map ?? {},
        price_floor_cents: String(dto.price_floor_cents ?? 0),
        timeout_ms: dto.timeout_ms ?? 3000,
        is_active: dto.is_active ?? true,
      }),
    );
  }

  async patchEndpoint(id: string, dto: PatchOutboundBuyerDto) {
    const ep = await this.endpointRepo.findOne({ where: { id } });
    if (!ep) throw new NotFoundException('Buyer endpoint not found');
    if (dto.name !== undefined) ep.name = dto.name;
    if (dto.ping_url !== undefined) ep.ping_url = dto.ping_url;
    if ('post_url' in dto) ep.post_url = dto.post_url ?? null;
    if ('auth_header_name' in dto) ep.auth_header_name = dto.auth_header_name ?? null;
    if ('auth_header_value' in dto) ep.auth_header_value = dto.auth_header_value ?? null;
    if (dto.field_map !== undefined) ep.field_map = dto.field_map;
    if (dto.price_floor_cents !== undefined) ep.price_floor_cents = String(dto.price_floor_cents);
    if (dto.timeout_ms !== undefined) ep.timeout_ms = dto.timeout_ms;
    if (dto.is_active !== undefined) ep.is_active = dto.is_active;
    return this.endpointRepo.save(ep);
  }

  async deleteEndpoint(id: string) {
    const ep = await this.endpointRepo.findOne({ where: { id } });
    if (!ep) throw new NotFoundException('Buyer endpoint not found');
    await this.endpointRepo.delete(id);
    return { ok: true };
  }

  listLogs(limit = 50, leadId?: string) {
    return this.logRepo.find({
      where: leadId ? { lead_id: leadId } : {},
      order: { created_at: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  // ── Test ping ─────────────────────────────────────────────────────────────

  async testPing(id: string) {
    const endpoint = await this.endpointRepo.findOne({ where: { id } });
    if (!endpoint) throw new NotFoundException('Buyer endpoint not found');

    const dummyPayload: Record<string, unknown> = {
      lead_id: `TEST-${Date.now()}`,
      state: 'TX',
      zip_code: '77494',
      market: 'Houston, TX',
      lead_type: 'motivated_seller',
      quality_score: 75,
      exclusive: false,
      timestamp: new Date().toISOString(),
    };

    const attempt = await this.sendPing(endpoint, dummyPayload);

    const log = await this.logRepo.save(
      this.logRepo.create({
        lead_id: null,
        buyer_endpoint_id: endpoint.id,
        status: attempt.status,
        bid_price_cents: attempt.bidCents != null ? String(attempt.bidCents) : null,
        floor_price_cents: endpoint.price_floor_cents,
        response_payload: attempt.responsePayload,
        latency_ms: attempt.latencyMs,
        error_message: attempt.errorMessage,
        is_test: true,
      }),
    );

    return {
      log_id: log.id,
      status: attempt.status,
      bid_price_cents: attempt.bidCents,
      latency_ms: attempt.latencyMs,
      response: attempt.responsePayload,
      error: attempt.errorMessage,
    };
  }

  // ── Live outbound ping flow ───────────────────────────────────────────────

  async pingAll(lead: Lead): Promise<OutboundPingResult> {
    const endpoints = await this.endpointRepo.find({ where: { is_active: true } });
    if (endpoints.length === 0) return { sold: false, attempts: 0 };

    const pingPayload = this.buildPingPayload(lead);

    const attempts = await Promise.all(
      endpoints.map((ep) => this.sendPing(ep, pingPayload)),
    );

    await this.logAll(lead.id, attempts);

    const accepted = attempts
      .filter((a) => a.status === 'accepted' && a.bidCents != null)
      .sort((a, b) => (b.bidCents ?? 0) - (a.bidCents ?? 0));

    if (accepted.length === 0) return { sold: false, attempts: attempts.length };

    const winner = accepted[0];
    const posted = await this.postToWinner(winner.endpoint, lead, winner.bidCents!);

    if (posted) {
      await this.logRepo.update(
        { lead_id: lead.id, buyer_endpoint_id: winner.endpoint.id },
        { status: 'posted' },
      );
    }

    return {
      sold: posted,
      buyerName: posted ? winner.endpoint.name : undefined,
      priceCents: posted ? winner.bidCents! : undefined,
      attempts: attempts.length,
    };
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private buildPingPayload(lead: Lead): Record<string, unknown> {
    const meta = (lead.metadata as Record<string, unknown>) ?? {};
    return {
      lead_id: lead.id,
      market: lead.market,
      lead_type: lead.lead_type,
      quality_score: lead.quality_score,
      exclusive: lead.exclusivity_level === 'exclusive',
      state: (meta.state as string) ?? lead.market?.split(',')[1]?.trim() ?? null,
      zip_code: (meta.zip as string) ?? null,
      county: (meta.county as string) ?? null,
      timestamp: new Date().toISOString(),
    };
  }

  private buildPostPayload(lead: Lead): Record<string, unknown> {
    const meta = (lead.metadata as Record<string, unknown>) ?? {};
    const sellerName = String(meta.seller_name ?? '');
    return {
      lead_id: lead.id,
      market: lead.market,
      lead_type: lead.lead_type,
      quality_score: lead.quality_score,
      exclusive: lead.exclusivity_level === 'exclusive',
      first_name: (meta.first_name as string) ?? sellerName.split(' ')[0] ?? null,
      last_name: (meta.last_name as string) ?? (sellerName.split(' ').slice(1).join(' ') || null),
      email: (meta.email as string) ?? null,
      phone: (meta.phone as string) ?? null,
      address: (meta.address as string) ?? null,
      city: (meta.city as string) ?? null,
      state: (meta.state as string) ?? null,
      zip: (meta.zip as string) ?? null,
      notes: (meta.notes as string) ?? null,
      timestamp: new Date().toISOString(),
    };
  }

  private applyFieldMap(
    payload: Record<string, unknown>,
    fieldMap: Record<string, string>,
  ): Record<string, unknown> {
    if (!fieldMap || Object.keys(fieldMap).length === 0) return payload;
    const result: Record<string, unknown> = {};
    for (const [ourKey, value] of Object.entries(payload)) {
      const theirKey = fieldMap[ourKey] ?? ourKey;
      result[theirKey] = value;
    }
    return result;
  }

  private async sendPing(
    endpoint: OutboundBuyerEndpoint,
    payload: Record<string, unknown>,
  ): Promise<PingAttempt> {
    const start = Date.now();
    const mapped = this.applyFieldMap(payload, endpoint.field_map);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), endpoint.timeout_ms);

      const response = await fetch(endpoint.ping_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(endpoint.auth_header_name && endpoint.auth_header_value
            ? { [endpoint.auth_header_name]: endpoint.auth_header_value }
            : {}),
        },
        body: JSON.stringify(mapped),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      const latencyMs = Date.now() - start;
      let responsePayload: Record<string, unknown> | null = null;

      try {
        responsePayload = await response.json() as Record<string, unknown>;
      } catch {
        // non-JSON body — treated as decline
      }

      if (!response.ok || !responsePayload) {
        return {
          endpoint,
          status: 'declined',
          bidCents: null,
          latencyMs,
          responsePayload,
          errorMessage: `HTTP ${response.status}`,
        };
      }

      const status = String(responsePayload.status ?? '').toLowerCase();
      const rawBid = Number(
        (responsePayload.bid_price ?? responsePayload.price ?? responsePayload.bid) || 0,
      );
      const bidCents = Number.isFinite(rawBid) && rawBid > 0
        ? Math.round(rawBid * 100)
        : null;

      if (status !== 'accepted' || bidCents == null) {
        return { endpoint, status: 'declined', bidCents: null, latencyMs, responsePayload, errorMessage: null };
      }

      const floorCents = Number(endpoint.price_floor_cents);
      if (bidCents < floorCents) {
        return {
          endpoint,
          status: 'below_floor',
          bidCents,
          latencyMs,
          responsePayload,
          errorMessage: `Bid $${(bidCents / 100).toFixed(2)} below floor $${(floorCents / 100).toFixed(2)}`,
        };
      }

      return { endpoint, status: 'accepted', bidCents, latencyMs, responsePayload, errorMessage: null };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return {
        endpoint,
        status: isTimeout ? 'timeout' : 'error',
        bidCents: null,
        latencyMs,
        responsePayload: null,
        errorMessage: isTimeout
          ? 'Request timed out'
          : err instanceof Error
          ? err.message
          : 'Unknown error',
      };
    }
  }

  private async postToWinner(
    endpoint: OutboundBuyerEndpoint,
    lead: Lead,
    bidCents: number,
  ): Promise<boolean> {
    const postUrl = endpoint.post_url ?? endpoint.ping_url;
    const payload = this.buildPostPayload(lead);
    const mapped = this.applyFieldMap(
      { ...payload, agreed_price: bidCents / 100, agreed_price_cents: bidCents },
      endpoint.field_map,
    );

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), endpoint.timeout_ms * 2);
      const response = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(endpoint.auth_header_name && endpoint.auth_header_value
            ? { [endpoint.auth_header_name]: endpoint.auth_header_value }
            : {}),
        },
        body: JSON.stringify(mapped),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      return response.ok;
    } catch (err) {
      this.logger.error(`POST to buyer "${endpoint.name}" failed: ${err}`);
      return false;
    }
  }

  private async logAll(leadId: string, attempts: PingAttempt[]): Promise<void> {
    if (attempts.length === 0) return;
    await this.logRepo.save(
      attempts.map((a) =>
        this.logRepo.create({
          lead_id: leadId,
          buyer_endpoint_id: a.endpoint.id,
          status: a.status,
          bid_price_cents: a.bidCents != null ? String(a.bidCents) : null,
          floor_price_cents: a.endpoint.price_floor_cents,
          response_payload: a.responsePayload,
          latency_ms: a.latencyMs,
          error_message: a.errorMessage,
          is_test: false,
        }),
      ),
    );
  }
}
