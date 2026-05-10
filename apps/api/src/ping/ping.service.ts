import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { PurchaseType } from '../../common/enums/purchase-type.enum';
import { ExclusivityLevel } from '../../common/enums/exclusivity-level.enum';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { BuyerPricingRule } from '../entities/buyer-pricing-rule.entity';
import { Lead } from '../entities/lead.entity';
import { LeadPing } from '../entities/lead-ping.entity';
import { LeadPost } from '../entities/lead-post.entity';
import { PingMatchAudit } from '../entities/ping-match-audit.entity';
import { User } from '../entities/user.entity';
import { VendorIntegration } from '../entities/vendor-integration.entity';
import { LeadsService } from '../leads/leads.service';
import { LeadPricingService } from '../leads/lead-pricing.service';
import {
  CreateVendorIntegrationDto,
  PatchVendorIntegrationDto,
} from './dto/admin-vendor-integration.dto';
import { UpsertBuyerPricingRuleDto } from './dto/buyer-pricing-rule.dto';
import { VendorPingDto } from './dto/vendor-ping.dto';
import { VendorPostDto } from './dto/vendor-post.dto';
import { PingMatchingService } from './ping-matching.service';

@Injectable()
export class PingService {
  constructor(
    @InjectRepository(VendorIntegration)
    private readonly vendorRepo: Repository<VendorIntegration>,
    @InjectRepository(BuyerPricingRule)
    private readonly pricingRuleRepo: Repository<BuyerPricingRule>,
    @InjectRepository(LeadPing)
    private readonly pingRepo: Repository<LeadPing>,
    @InjectRepository(LeadPost)
    private readonly postRepo: Repository<LeadPost>,
    @InjectRepository(PingMatchAudit)
    private readonly auditRepo: Repository<PingMatchAudit>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly dataSource: DataSource,
    private readonly matcher: PingMatchingService,
    private readonly leadsService: LeadsService,
    private readonly leadPricingService: LeadPricingService,
  ) {}

  async receivePing(apiKey: string | undefined, dto: VendorPingDto) {
    const start = Date.now();
    const vendor = await this.authenticateVendor(apiKey);
    this.assertAllowedSource(vendor, dto.source);

    const existing = await this.pingRepo.findOne({
      where: {
        vendor: { id: vendor.id },
        vendor_ping_id: dto.vendor_ping_id,
      },
      relations: { matched_buyer: true },
    });
    if (existing) return this.toPingResponse(existing);

    const duplicate = await this.findDuplicateLead({
      phone: dto.metadata?.phone,
      email: dto.metadata?.email,
      address: dto.metadata?.address,
      zip: dto.zip,
    });

    const ping = this.pingRepo.create({
      vendor,
      vendor_ping_id: dto.vendor_ping_id,
      status: 'pending',
      market: this.marketFromDto(dto),
      city: this.clean(dto.city),
      state: this.clean(dto.state)?.toUpperCase() ?? null,
      zip: this.clean(dto.zip),
      county: this.clean(dto.county),
      property_type: this.clean(dto.property_type),
      lead_type: dto.lead_type,
      source: this.clean(dto.source),
      exclusivity_choice: dto.exclusivity_choice ?? 'exclusive',
      payload: dto as Record<string, any>,
      expires_at: null,
    });
    const savedPing = await this.pingRepo.save(ping);

    if (duplicate) {
      savedPing.status = 'rejected';
      savedPing.rejection_reason = 'duplicate_lead';
      savedPing.latency_ms = Date.now() - start;
      await this.pingRepo.save(savedPing);
      return this.toPingResponse(savedPing);
    }

    const result = await this.matcher.match(savedPing);
    savedPing.latency_ms = Date.now() - start;
    if (!result.accepted) {
      savedPing.status = 'rejected';
      savedPing.rejection_reason = result.rejectionReason ?? 'no_match';
    } else {
      savedPing.status = 'accepted';
      savedPing.matched_buyer = { id: result.buyerId } as User;
      savedPing.matched_pricing_rule = { id: result.pricingRuleId } as BuyerPricingRule;
      savedPing.matched_price_cents = result.priceCents ?? null;
      savedPing.expires_at = new Date(Date.now() + vendor.ping_ttl_seconds * 1000);
    }

    return this.toPingResponse(await this.pingRepo.save(savedPing));
  }

  async receivePost(apiKey: string | undefined, dto: VendorPostDto) {
    const vendor = await this.authenticateVendor(apiKey);
    const existingPost = await this.postRepo.findOne({
      where: { vendor: { id: vendor.id }, vendor_lead_id: dto.vendor_lead_id },
      relations: { lead: true, ping: true },
    });
    if (existingPost) {
      return {
        accepted: existingPost.status === 'accepted',
        post_id: existingPost.id,
        lead_id: existingPost.lead?.id ?? null,
        status: existingPost.status,
        error: existingPost.error_message,
      };
    }

    const ping = await this.pingRepo.findOne({
      where: { id: dto.ping_id, vendor: { id: vendor.id } },
      relations: { matched_buyer: true },
    });
    if (!ping) throw new NotFoundException('Ping not found');
    if (ping.status !== 'accepted') throw new BadRequestException('Ping is not accepted');
    if (!ping.matched_buyer || !ping.matched_price_cents) {
      throw new BadRequestException('Ping does not have a matched buyer');
    }
    if (ping.expires_at && ping.expires_at < new Date()) {
      ping.status = 'expired';
      await this.pingRepo.save(ping);
      throw new BadRequestException('Ping has expired');
    }

    const duplicate = await this.findDuplicateLead({
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      zip: ping.zip,
    });
    if (duplicate) {
      const rejected = await this.postRepo.save(
        this.postRepo.create({
          vendor,
          ping,
          vendor_lead_id: dto.vendor_lead_id,
          lead: null,
          status: 'rejected',
          delivery_status: null,
          error_message: 'duplicate_lead',
          payload: dto as Record<string, any>,
        }),
      );
      return { accepted: false, post_id: rejected.id, status: 'rejected', error: 'duplicate_lead' };
    }

    const lead = await this.createPostedLead(ping, dto);
    const post = await this.postRepo.save(
      this.postRepo.create({
        vendor,
        ping,
        vendor_lead_id: dto.vendor_lead_id,
        lead,
        status: 'pending',
        delivery_status: null,
        error_message: null,
        payload: dto as Record<string, any>,
      }),
    );

    try {
      const assignment = await this.leadsService.buyLead(
        ping.matched_buyer.id,
        lead.id,
        PurchaseType.VENDOR_PING,
        ping.exclusivity_choice,
      );
      post.status = 'accepted';
      post.delivery_status = 'assigned';
      await this.postRepo.save(post);
      ping.status = 'posted';
      await this.pingRepo.save(ping);
      return {
        accepted: true,
        post_id: post.id,
        lead_id: lead.id,
        assignment_id: assignment.id,
        buyer_id: ping.matched_buyer.id,
        price_cents: assignment.amount_charged_cents,
        status: 'accepted',
      };
    } catch (error) {
      post.status = 'failed';
      post.error_message = error instanceof Error ? error.message : 'assignment_failed';
      await this.postRepo.save(post);
      lead.status = LeadStatus.ARCHIVED;
      await this.leadRepo.save(lead);
      throw error;
    }
  }

  listPricingRules(userId: string) {
    return this.pricingRuleRepo.find({
      where: { user: { id: userId } },
      order: { priority: 'DESC', created_at: 'ASC' },
    });
  }

  async upsertPricingRule(userId: string, dto: UpsertBuyerPricingRuleDto) {
    const existing = dto.id
      ? await this.pricingRuleRepo.findOne({
          where: { id: dto.id },
          relations: { user: true },
        })
      : null;
    if (existing && existing.user.id !== userId) {
      throw new ForbiddenException('Not your pricing rule');
    }

    const rule =
      existing ??
      this.pricingRuleRepo.create({
        user: { id: userId } as User,
        name: dto.name,
      });

    rule.name = dto.name;
    if (dto.is_active !== undefined) rule.is_active = dto.is_active;
    if (dto.paused !== undefined) rule.paused = dto.paused;
    if (dto.priority !== undefined) rule.priority = dto.priority;
    if (dto.markets !== undefined) rule.markets = dto.markets;
    if (dto.states !== undefined) rule.states = dto.states;
    if (dto.cities !== undefined) rule.cities = dto.cities;
    if (dto.zips !== undefined) rule.zips = dto.zips;
    if (dto.counties !== undefined) rule.counties = dto.counties;
    if (dto.property_types !== undefined) rule.property_types = dto.property_types;
    if (dto.lead_types !== undefined) rule.lead_types = dto.lead_types;
    if (dto.fixed_price_cents !== undefined) {
      rule.fixed_price_cents = dto.fixed_price_cents === null ? null : String(dto.fixed_price_cents);
    }
    if (dto.max_bid_cents !== undefined) {
      rule.max_bid_cents = dto.max_bid_cents === null ? null : String(dto.max_bid_cents);
    }
    if (dto.exclusivity_preference !== undefined) rule.exclusivity_preference = dto.exclusivity_preference;
    if (dto.routing_strategy !== undefined) rule.routing_strategy = dto.routing_strategy;

    return this.pricingRuleRepo.save(rule);
  }

  async deletePricingRule(userId: string, id: string) {
    const rule = await this.pricingRuleRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!rule) throw new NotFoundException('Pricing rule not found');
    if (rule.user.id !== userId) throw new ForbiddenException('Not your pricing rule');
    await this.pricingRuleRepo.delete(id);
    return { ok: true };
  }

  listVendors() {
    return this.vendorRepo.find({ order: { created_at: 'DESC' } });
  }

  createVendor(dto: CreateVendorIntegrationDto) {
    return this.vendorRepo.save(
      this.vendorRepo.create({
        name: dto.name,
        api_key_hash: this.hashApiKey(dto.api_key),
        enabled: dto.enabled ?? true,
        allowed_sources: dto.allowed_sources ?? [],
        ping_timeout_ms: dto.ping_timeout_ms ?? 750,
        ping_ttl_seconds: dto.ping_ttl_seconds ?? 900,
        metadata: dto.metadata ?? {},
      }),
    );
  }

  async patchVendor(id: string, dto: PatchVendorIntegrationDto) {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (dto.name !== undefined) vendor.name = dto.name;
    if (dto.api_key !== undefined) vendor.api_key_hash = this.hashApiKey(dto.api_key);
    if (dto.enabled !== undefined) vendor.enabled = dto.enabled;
    if (dto.allowed_sources !== undefined) vendor.allowed_sources = dto.allowed_sources;
    if (dto.ping_timeout_ms !== undefined) vendor.ping_timeout_ms = dto.ping_timeout_ms;
    if (dto.ping_ttl_seconds !== undefined) vendor.ping_ttl_seconds = dto.ping_ttl_seconds;
    if (dto.metadata !== undefined) vendor.metadata = dto.metadata;
    return this.vendorRepo.save(vendor);
  }

  async listPings(limit = 50) {
    return this.pingRepo.find({
      relations: { vendor: true, matched_buyer: true, matched_pricing_rule: true },
      order: { created_at: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async getPing(id: string) {
    const ping = await this.pingRepo.findOne({
      where: { id },
      relations: { vendor: true, matched_buyer: true, matched_pricing_rule: true },
    });
    if (!ping) throw new NotFoundException('Ping not found');
    const audit = await this.auditRepo.find({
      where: { ping: { id } },
      relations: { buyer: true, pricing_rule: true },
      order: { created_at: 'ASC' },
    });
    return { ping, audit };
  }

  private async authenticateVendor(apiKey: string | undefined) {
    if (!apiKey) throw new UnauthorizedException('Missing vendor API key');
    const vendor = await this.vendorRepo.findOne({
      where: { api_key_hash: this.hashApiKey(apiKey), enabled: true },
    });
    if (!vendor) throw new UnauthorizedException('Invalid vendor API key');
    return vendor;
  }

  private async createPostedLead(ping: LeadPing, dto: VendorPostDto): Promise<Lead> {
    const metadata = {
      ...(ping.payload ?? {}),
      ...(dto.metadata ?? {}),
      seller_name: dto.seller_name,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address,
      notes: dto.notes ?? null,
      vendor_ping_id: ping.vendor_ping_id,
      vendor_lead_id: dto.vendor_lead_id,
      city: ping.city,
      state: ping.state,
      zip: ping.zip,
      county: ping.county,
      property_type: ping.property_type,
    };

    const lead = this.leadRepo.create({
      external_id: dto.vendor_lead_id,
      source: ping.source ?? 'vendor_ping',
      market: ping.market ?? this.marketFromParts(ping.city, ping.state, ping.zip),
      lead_type: ping.lead_type,
      status: LeadStatus.AVAILABLE,
      exclusivity_level:
        ping.exclusivity_choice === 'exclusive' ? ExclusivityLevel.EXCLUSIVE : ExclusivityLevel.SHARED,
      quality_score: dto.quality_score ?? 70,
      price_cents: ping.matched_price_cents ?? '0',
      exclusive_price_cents: ping.matched_price_cents,
      shared_price_cents: ping.matched_price_cents,
      max_non_exclusive_buyers: ping.exclusivity_choice === 'exclusive' ? 1 : 3,
      title: `${ping.lead_type} lead in ${ping.market ?? ping.zip ?? ping.state ?? 'matched market'}`,
      metadata,
      canonical_lead_source: ping.source ?? 'vendor_ping',
      utm: {},
      early_access_until: null,
    });

    const saved = await this.leadRepo.save(lead);
    return this.leadPricingService.applyTierToLead(saved);
  }

  private async findDuplicateLead(input: {
    phone?: unknown;
    email?: unknown;
    address?: unknown;
    zip?: unknown;
  }) {
    const clauses: string[] = [];
    const params: Record<string, string> = {};
    const phone = this.clean(input.phone);
    const email = this.clean(input.email)?.toLowerCase() ?? null;
    const address = this.clean(input.address)?.toLowerCase() ?? null;
    const zip = this.clean(input.zip);

    if (phone) {
      clauses.push(`LOWER(TRIM(COALESCE(lead.metadata->>'phone',''))) = :phone`);
      params.phone = phone.toLowerCase();
    }
    if (email) {
      clauses.push(`LOWER(TRIM(COALESCE(lead.metadata->>'email',''))) = :email`);
      params.email = email;
    }
    if (address) {
      clauses.push(
        `(LOWER(TRIM(COALESCE(lead.metadata->>'address',''))) = :address${
          zip ? " AND TRIM(COALESCE(lead.metadata->>'zip','')) = :zip" : ''
        })`,
      );
      params.address = address;
      if (zip) params.zip = zip;
    }
    if (clauses.length === 0) return null;

    return this.leadRepo
      .createQueryBuilder('lead')
      .where(`(${clauses.join(' OR ')})`, params)
      .orderBy('lead.created_at', 'ASC')
      .getOne();
  }

  private toPingResponse(ping: LeadPing) {
    return {
      accepted: ping.status === 'accepted' || ping.status === 'posted',
      status: ping.status,
      ping_id: ping.id,
      vendor_ping_id: ping.vendor_ping_id,
      price_cents: ping.matched_price_cents,
      matched_buyer_id: ping.matched_buyer?.id ?? null,
      expires_at: ping.expires_at,
      rejection_reason: ping.rejection_reason,
      latency_ms: ping.latency_ms,
    };
  }

  private assertAllowedSource(vendor: VendorIntegration, source?: string) {
    if (!vendor.allowed_sources || vendor.allowed_sources.length === 0 || !source) return;
    const allowed = vendor.allowed_sources.map((s) => s.trim().toLowerCase());
    if (!allowed.includes(source.trim().toLowerCase())) {
      throw new ForbiddenException('Vendor source is not allowed');
    }
  }

  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  private marketFromDto(dto: VendorPingDto): string {
    if (dto.market?.trim()) return dto.market.trim();
    return this.marketFromParts(dto.city, dto.state, dto.zip);
  }

  private marketFromParts(city?: string | null, state?: string | null, zip?: string | null): string {
    const cityState = [this.clean(city), this.clean(state)?.toUpperCase()].filter(Boolean).join(', ');
    return cityState || this.clean(zip) || 'Unknown market';
  }

  private clean(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }
}
