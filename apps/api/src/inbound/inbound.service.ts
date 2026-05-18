import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { VendorIntegration } from '../entities/vendor-integration.entity';
import { VendorWebhookHit } from '../entities/vendor-webhook-hit.entity';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { ExclusivityLevel } from '../../common/enums/exclusivity-level.enum';
import { hashApiKey } from '../common/utils/hash-api-key.util';
import { InboundLeadDto } from './dto/inbound-lead.dto';
import { OutboundPingService } from '../outbound/outbound-ping.service';

@Injectable()
export class InboundService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(VendorIntegration)
    private readonly vendorRepo: Repository<VendorIntegration>,
    @InjectRepository(VendorWebhookHit)
    private readonly hitRepo: Repository<VendorWebhookHit>,
    private readonly outboundPingService: OutboundPingService,
  ) {}

  async authenticateVendor(apiKey: string): Promise<VendorIntegration> {
    const hash = hashApiKey(apiKey);
    const vendor = await this.vendorRepo.findOne({
      where: { api_key_hash: hash, enabled: true },
    });
    if (!vendor) {
      throw new UnauthorizedException('Invalid or disabled vendor key');
    }
    return vendor;
  }

  async createLead(
    vendor: VendorIntegration,
    dto: InboundLeadDto,
    ipAddress: string,
    rawPayload: Record<string, unknown>,
  ): Promise<Lead> {
    const priceCents = dto.price_cents ?? dto.exclusive_price_cents ?? dto.shared_price_cents ?? 0;

    const lead = this.leadRepo.create({
      source: 'inbound',
      canonical_lead_source: vendor.id,
      market: dto.market,
      lead_type: dto.lead_type,
      title: dto.title ?? `${dto.lead_type} — ${dto.market}`,
      status: LeadStatus.AVAILABLE,
      exclusivity_level: ExclusivityLevel.SHARED,
      quality_score: dto.quality_score ?? 70,
      price_cents: String(priceCents),
      list_price_anchor_cents: String(priceCents),
      exclusive_price_cents: dto.exclusive_price_cents != null ? String(dto.exclusive_price_cents) : null,
      shared_price_cents: dto.shared_price_cents != null ? String(dto.shared_price_cents) : null,
      metadata: dto.metadata ?? {},
      utm: {},
    });

    const saved = await this.leadRepo.save(lead);

    await this.hitRepo.save(
      this.hitRepo.create({
        vendor_id: vendor.id,
        lead_id: saved.id,
        status: 'accepted',
        ip_address: ipAddress,
        payload_snapshot: rawPayload,
      }),
    );

    // Fire-and-forget: ping outbound buyers with non-PII data
    void this.outboundPingService.pingAll(saved).catch(() => {/* logged internally */});

    return saved;
  }

  async logRejection(
    vendorId: string | null,
    reason: string,
    ipAddress: string,
    rawPayload: Record<string, unknown>,
  ): Promise<void> {
    await this.hitRepo.save(
      this.hitRepo.create({
        vendor_id: vendorId,
        lead_id: null,
        status: 'rejected',
        rejection_reason: reason,
        ip_address: ipAddress,
        payload_snapshot: rawPayload,
      }),
    );
  }
}
