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
  /** ping_id returned by the external system — must be sent back on the POST */
  externalPingId: string | null;
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
        static_fields: dto.static_fields ?? {},
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
    if (dto.static_fields !== undefined) ep.static_fields = dto.static_fields;
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
      zip_code: '00001',
      zip: '00001',
      market: 'Houston, TX',
      lead_type: 'motivated_seller',
      leadType: 'Outbound',
      quality_score: 75,
      exclusive: false,
      propertyType: 'Single Family',
      listed: 'false',
      timeline: 'ASAP',
      reason: null,
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
      external_ping_id: attempt.externalPingId,
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
    const posted = await this.postToWinner(
      winner.endpoint,
      lead,
      winner.bidCents!,
      winner.externalPingId,
    );

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

  // ── Payload builders ──────────────────────────────────────────────────────

  private buildPingPayload(lead: Lead): Record<string, unknown> {
    const meta = (lead.metadata as Record<string, unknown>) ?? {};
    const zip = (meta.zip as string) ?? null;
    const state =
      (meta.state as string) ?? lead.market?.split(',')[1]?.trim() ?? null;

    return {
      lead_id: lead.id,
      market: lead.market,
      // Internal type kept for non-Juiced buyers
      lead_type: lead.lead_type,
      // Juiced / common buyer required fields — values normalized
      leadType: this.toLeadType(lead),
      propertyType: this.toPropertyType(meta.property_type),
      listed: this.toListed(meta.listed),
      timeline: this.toTimeline(meta.timeline),
      // Location
      state,
      zip_code: zip,
      zip,
      county: (meta.county as string) ?? null,
      // Extra context
      quality_score: lead.quality_score,
      exclusive: lead.exclusivity_level === 'exclusive',
      reason: this.toReason(meta.reason),
      timestamp: new Date().toISOString(),
    };
  }

  private buildPostPayload(
    lead: Lead,
    externalPingId: string | null,
  ): Record<string, unknown> {
    const meta = (lead.metadata as Record<string, unknown>) ?? {};
    const utm = (lead.utm as Record<string, unknown>) ?? {};
    const sellerName = String(meta.seller_name ?? '');
    const city =
      (meta.city as string) ?? lead.market?.split(',')[0]?.trim() ?? null;
    const state =
      (meta.state as string) ?? lead.market?.split(',')[1]?.trim() ?? null;

    return {
      // External system's ping_id — required by Juiced
      ping_id: externalPingId ?? undefined,
      // Platform reference
      lead_id: lead.id,
      market: lead.market,
      lead_type: lead.lead_type,
      leadType: this.toLeadType(lead),
      quality_score: lead.quality_score,
      exclusive: lead.exclusivity_level === 'exclusive',
      // Seller identity
      first_name:
        (meta.first_name as string) ?? sellerName.split(' ')[0] ?? null,
      last_name:
        (meta.last_name as string) ??
        (sellerName.split(' ').slice(1).join(' ') || null),
      email: (meta.email as string) ?? null,
      phone: (meta.phone as string) ?? null,
      // Address — both formats
      address: (meta.address as string) ?? null,
      address_1: (meta.address as string) ?? null,
      address_2: (meta.address_2 as string) ?? null,
      city,
      state,
      zip: (meta.zip as string) ?? null,
      county: (meta.county as string) ?? null,
      // Property details — normalized values
      propertyType: this.toPropertyType(meta.property_type),
      listed: this.toListed(meta.listed),
      timeline: this.toTimeline(meta.timeline),
      reason: this.toReason(meta.reason),
      condition: (meta.condition as string) ?? null,
      // Compliance & tracking
      xxTrustedFormCertUrl:
        (meta.xxTrustedFormCertUrl as string) ??
        (meta.trusted_form_cert_url as string) ??
        null,
      IP_Address:
        (meta.ip_address as string) ?? (meta.IP_Address as string) ?? null,
      utm_source:
        (utm.source as string) ?? (meta.utm_source as string) ?? null,
      // Juiced expects MM/DD/YYYY
      submitted_at: this.toSubmittedAt(lead.created_at),
      notes: (meta.notes as string) ?? null,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Value normalizers (maps our internal values → Juiced/buyer enums) ─────

  /** "inbound" source → "Inbound", everything else → "Outbound" */
  private toLeadType(lead: Lead): string {
    return lead.source === 'inbound' ? 'Inbound' : 'Outbound';
  }

  /** Maps our snake_case property types to Juiced's human-readable list */
  private toPropertyType(raw: unknown): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const map: Record<string, string> = {
      single_family: 'Single Family',
      sfr: 'Single Family',
      single: 'Single Family',
      multi_family: 'Multi Family',
      multifamily: 'Multi Family',
      duplex: 'Multi Family',
      triplex: 'Multi Family',
      condo: 'Condo/Town Home',
      townhome: 'Condo/Town Home',
      townhouse: 'Condo/Town Home',
      condo_townhome: 'Condo/Town Home',
      mobile_home: 'Mobile Home',
      manufactured: 'Mobile Home',
      mobile: 'Mobile Home',
      land: 'Land',
      lot: 'Land',
      commercial: 'Commercial',
    };
    return map[raw.toLowerCase().replace(/[\s/-]/g, '_')] ?? raw;
  }

  /** Coerces any boolean/string listed value to Juiced's string enum */
  private toListed(raw: unknown): string {
    if (
      raw === true ||
      raw === 'true' ||
      raw === 'True' ||
      raw === 'yes' ||
      raw === '1' ||
      raw === 1
    ) {
      return 'true';
    }
    return 'false';
  }

  /** Maps our timeline values to Juiced's enum */
  private toTimeline(raw: unknown): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const map: Record<string, string> = {
      asap: 'ASAP',
      immediately: 'ASAP',
      now: 'ASAP',
      '30_days': 'Within 3 Months',
      within_3_months: 'Within 3 Months',
      '1_3_months': 'Within 3 Months',
      '60_days': 'Within 6 Months',
      within_6_months: 'Within 6 Months',
      '3_6_months': 'Within 6 Months',
      flexible: 'In no rush',
      no_rush: 'In no rush',
      in_no_rush: 'In no rush',
      not_sure: 'In no rush',
    };
    return map[raw.toLowerCase().replace(/[\s/-]/g, '_')] ?? raw;
  }

  /** Maps our motivation/reason values to Juiced's enum */
  private toReason(raw: unknown): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const map: Record<string, string> = {
      financial_hardship: 'Financial Hardship',
      financial: 'Financial Hardship',
      repairs: 'Repairs/Damage',
      damage: 'Repairs/Damage',
      repairs_damage: 'Repairs/Damage',
      divorce: 'Divorce',
      inherited: 'Inherited',
      probate: 'Inherited',
      downsizing: 'Downsizing',
      relocating: 'Relocating',
      relocation: 'Relocating',
      tired_landlord: 'Tired Landlord',
      landlord: 'Tired Landlord',
      quick_sale: 'Looking For a Quick Sale',
      looking_for_a_quick_sale: 'Looking For a Quick Sale',
      emergency: 'Emergency Reasons',
      emergency_reasons: 'Emergency Reasons',
      foreclosure: 'Foreclosure',
      pre_foreclosure: 'Foreclosure',
      just_curious: 'Just Curious',
      curious: 'Just Curious',
    };
    return map[raw.toLowerCase().replace(/[\s/-]/g, '_')] ?? raw;
  }

  /** Formats a date to MM/DD/YYYY as Juiced expects */
  private toSubmittedAt(date: Date | string | null | undefined): string {
    const d = date ? new Date(date as string) : new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  // ── Field map + static fields merge ──────────────────────────────────────

  /**
   * Rename keys via field_map, then overlay static_fields on top.
   * static_fields always win (allows setting vendor, source, etc.).
   */
  private buildFinalPayload(
    payload: Record<string, unknown>,
    endpoint: OutboundBuyerEndpoint,
  ): Record<string, unknown> {
    const mapped = this.applyFieldMap(payload, endpoint.field_map ?? {});
    return { ...mapped, ...(endpoint.static_fields ?? {}) };
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

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  private async sendPing(
    endpoint: OutboundBuyerEndpoint,
    payload: Record<string, unknown>,
  ): Promise<PingAttempt> {
    const start = Date.now();
    const mapped = this.buildFinalPayload(payload, endpoint);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), endpoint.timeout_ms);

      const response = await fetch(endpoint.ping_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
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
        responsePayload = (await response.json()) as Record<string, unknown>;
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
          externalPingId: null,
        };
      }

      // Capture the external ping_id (Juiced and compatible buyers return this)
      const externalPingId =
        typeof responsePayload.ping_id === 'string'
          ? responsePayload.ping_id
          : null;

      // Resolve bid price — accepts bid_price (cents), price (dollars), or bid (dollars)
      const rawBid = Number(
        responsePayload.bid_price ?? responsePayload.price ?? responsePayload.bid ?? 0,
      );
      // bid_price_cents is already in cents; price/bid are in dollars
      const bidCents =
        Number.isFinite(rawBid) && rawBid > 0
          ? responsePayload.bid_price != null
            ? Math.round(rawBid)          // bid_price field = already cents
            : Math.round(rawBid * 100)    // price/bid fields = dollars
          : null;

      // Accept if:
      //   - status === "accepted"  (our vendor format)
      //   - message includes "match found" (Juiced format)
      //   - positive bid with no explicit rejection
      const statusStr = String(responsePayload.status ?? '').toLowerCase();
      const messageStr = String(responsePayload.message ?? '').toLowerCase();
      const isExplicitlyDeclined =
        statusStr === 'declined' ||
        statusStr === 'rejected' ||
        messageStr.includes('no match') ||
        messageStr.includes('duplicate');

      const isAccepted =
        bidCents != null &&
        !isExplicitlyDeclined &&
        (statusStr === 'accepted' ||
          messageStr.includes('match found') ||
          // fallback: any positive bid that isn't explicitly rejected
          (!statusStr && !messageStr) ||
          (!isExplicitlyDeclined));

      if (!isAccepted || bidCents == null) {
        return {
          endpoint,
          status: 'declined',
          bidCents: null,
          latencyMs,
          responsePayload,
          errorMessage: null,
          externalPingId,
        };
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
          externalPingId,
        };
      }

      return {
        endpoint,
        status: 'accepted',
        bidCents,
        latencyMs,
        responsePayload,
        errorMessage: null,
        externalPingId,
      };
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
        externalPingId: null,
      };
    }
  }

  private async postToWinner(
    endpoint: OutboundBuyerEndpoint,
    lead: Lead,
    bidCents: number,
    externalPingId: string | null,
  ): Promise<boolean> {
    const postUrl = endpoint.post_url ?? endpoint.ping_url;
    const payload = this.buildPostPayload(lead, externalPingId);
    const mapped = this.buildFinalPayload(
      { ...payload, agreed_price: bidCents / 100, agreed_price_cents: bidCents },
      endpoint,
    );

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), endpoint.timeout_ms * 2);
      const response = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
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
