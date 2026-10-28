import {
  Injectable,
  Logger,
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
import { LeadPricingService } from '../lead-pricing/lead-pricing.service';
import { DistributionService } from '../distribution/distribution.service';
import { OutboundPingService } from '../outbound/outbound-ping.service';

@Injectable()
export class InboundService {
  private readonly logger = new Logger(InboundService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(VendorIntegration)
    private readonly vendorRepo: Repository<VendorIntegration>,
    @InjectRepository(VendorWebhookHit)
    private readonly hitRepo: Repository<VendorWebhookHit>,
    private readonly leadPricingService: LeadPricingService,
    private readonly distributionService: DistributionService,
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
    // Pricing always from admin-controlled lead_pricing_config
    const { exclusive, shared } = await this.leadPricingService.getPricesForLead(dto.lead_type);

    const lead = this.leadRepo.create({
      source: 'inbound',
      canonical_lead_source: vendor.id,
      market: dto.market,
      lead_type: dto.lead_type,
      title: dto.title ?? `${dto.lead_type} — ${dto.market}`,
      // Goes directly to marketplace — no admin approval step
      status: LeadStatus.AVAILABLE,
      exclusivity_level: ExclusivityLevel.SHARED,
      quality_score: dto.quality_score ?? 70,
      price_cents: exclusive,
      list_price_anchor_cents: exclusive,
      exclusive_price_cents: exclusive,
      shared_price_cents: shared,
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

    // Enqueue auto-distribution to buyers who match this lead's criteria
    void this.distributionService
      .enqueueLeadDistribution(saved.id)
      .catch((e) => this.logger.warn(`Distribution enqueue failed for lead ${saved.id}: ${e instanceof Error ? e.message : e}`));

    // Fire outbound buyer pings (e.g. Juiced) — highest bidder wins
    void this.outboundPingService
      .pingAll(saved)
      .catch((e) => this.logger.warn(`Outbound ping failed for lead ${saved.id}: ${e instanceof Error ? e.message : e}`));

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
