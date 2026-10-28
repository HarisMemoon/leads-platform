import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { PurchaseType } from "../../common/enums/purchase-type.enum";
import { ExclusivityLevel } from "../../common/enums/exclusivity-level.enum";
import { LeadStatus } from "../../common/enums/lead-status.enum";
import { BuyerPricingRule } from "../entities/buyer-pricing-rule.entity";
import { Lead } from "../entities/lead.entity";
import { LeadPing } from "../entities/lead-ping.entity";
import { LeadPost } from "../entities/lead-post.entity";
import { PingMatchAudit } from "../entities/ping-match-audit.entity";
import { User } from "../entities/user.entity";
import { VendorIntegration } from "../entities/vendor-integration.entity";
import { VendorWebhookHit } from "../entities/vendor-webhook-hit.entity";
import { LeadsService } from "../leads/leads.service";
import { LeadDedupService } from "../leads/lead-dedup.service";
import { LeadPricingService } from "../leads/lead-pricing.service";
import { LeadPricingService as LeadPricingConfigService } from "../lead-pricing/lead-pricing.service";
import { OutboundPingService } from "../outbound/outbound-ping.service";
import { DistributionService } from "../distribution/distribution.service";
import {
  CreateVendorIntegrationDto,
  PatchVendorIntegrationDto,
} from "./dto/admin-vendor-integration.dto";
import { UpsertBuyerPricingRuleDto } from "./dto/buyer-pricing-rule.dto";
import { VendorDirectLeadDto } from "./dto/vendor-direct-lead.dto";
import { VendorPingDto } from "./dto/vendor-ping.dto";
import { VendorPostDto } from "./dto/vendor-post.dto";
import { PingMatchingService } from "./ping-matching.service";

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
    @InjectRepository(VendorWebhookHit)
    private readonly hitRepo: Repository<VendorWebhookHit>,
    private readonly dataSource: DataSource,
    private readonly matcher: PingMatchingService,
    private readonly leadsService: LeadsService,
    private readonly leadPricingService: LeadPricingService,
    private readonly outboundPingService: OutboundPingService,
    private readonly leadPricingConfigService: LeadPricingConfigService,
    private readonly distributionService: DistributionService,
    private readonly leadDedupService: LeadDedupService,
  ) {}

  async receivePing(apiKey: string | undefined, dto: VendorPingDto) {
    const start = Date.now();
    const vendor = await this.authenticateVendor(apiKey);
    this.assertAllowedSource(vendor, dto.source);

    // Juiced and similar vendors don't send their own ping ID — generate one
    const vendorPingId = dto.vendor_ping_id?.trim() || randomUUID();

    const existing = await this.pingRepo.findOne({
      where: {
        vendor: { id: vendor.id },
        vendor_ping_id: vendorPingId,
      },
      relations: { matched_buyer: true },
    });
    if (existing) return this.toPingResponse(existing);

    const duplicate = await this.findDuplicateLead({
      phone: dto.phone ?? dto.metadata?.phone,
      email: dto.email ?? dto.metadata?.email,
      address: dto.fulladdress ?? dto.address_1 ?? dto.metadata?.address,
      zip: dto.zip ?? dto.Zip,
    });

    const ping = this.pingRepo.create({
      vendor,
      vendor_ping_id: vendorPingId,
      status: "pending",
      market: this.marketFromDto(dto),
      city: this.clean(dto.city),
      state: this.clean(dto.state)?.toUpperCase() ?? null,
      zip: this.clean(dto.zip ?? dto.Zip),
      county: this.clean(dto.county),
      property_type: this.clean(
        dto.property_type ?? dto.Propertytype ?? dto.propertyType,
      ),
      lead_type: dto.lead_type ?? dto.leadType ?? "motivated_seller",
      source: this.clean(dto.source),
      exclusivity_choice: dto.exclusivity_choice ?? "exclusive",
      payload: dto as Record<string, any>,
      expires_at: null,
    });
    const savedPing = await this.pingRepo.save(ping);

    if (duplicate) {
      savedPing.status = "rejected";
      savedPing.rejection_reason = "duplicate_lead";
      savedPing.latency_ms = Date.now() - start;
      await this.pingRepo.save(savedPing);
      return this.toPingResponse(savedPing);
    }

    const result = await this.matcher.match(savedPing);
    savedPing.latency_ms = Date.now() - start;
    if (!result.accepted) {
      savedPing.status = "rejected";
      savedPing.rejection_reason = result.rejectionReason ?? "no_match";
    } else {
      savedPing.status = "accepted";
      savedPing.matched_buyer = { id: result.buyerId } as User;
      savedPing.matched_pricing_rule = {
        id: result.pricingRuleId,
      } as BuyerPricingRule;
      savedPing.matched_price_cents = result.priceCents ?? null;
      savedPing.expires_at = new Date(
        Date.now() + vendor.ping_ttl_seconds * 1000,
      );
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
        accepted: existingPost.status === "accepted",
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
    if (!ping) throw new NotFoundException("Ping not found");
    if (ping.status !== "accepted")
      throw new BadRequestException("Ping is not accepted");
    if (!ping.matched_buyer || !ping.matched_price_cents) {
      throw new BadRequestException("Ping does not have a matched buyer");
    }
    if (ping.expires_at && ping.expires_at < new Date()) {
      ping.status = "expired";
      await this.pingRepo.save(ping);
      throw new BadRequestException("Ping has expired");
    }

    const duplicate = await this.findDuplicateLead({
      phone: dto.phone,
      email: dto.email,
      address: dto.address ?? dto.fulladdress ?? dto.address_1,
      zip: dto.zip ?? dto.Zip ?? ping.zip,
    });
    if (duplicate) {
      const rejected = await this.postRepo.save(
        this.postRepo.create({
          vendor,
          ping,
          vendor_lead_id: dto.vendor_lead_id,
          lead: null,
          status: "rejected",
          delivery_status: null,
          error_message: "duplicate_lead",
          payload: dto as Record<string, any>,
        }),
      );

      // Still attempt outbound buyer pings for the existing duplicate lead
      // so it can be offered to the highest external bidder
      void this.outboundPingService.pingAll(duplicate).catch(() => {
        /* logged internally */
      });

      return {
        accepted: false,
        post_id: rejected.id,
        status: "rejected",
        error: "duplicate_lead",
        duplicate_lead_id: duplicate.id,
        note: "Lead already exists in platform. Forwarding to outbound buyers.",
      };
    }

    const lead = await this.createPostedLead(ping, dto);
    const post = await this.postRepo.save(
      this.postRepo.create({
        vendor,
        ping,
        vendor_lead_id: dto.vendor_lead_id,
        lead,
        status: "pending",
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
      post.status = "accepted";
      post.delivery_status = "assigned";
      await this.postRepo.save(post);
      ping.status = "posted";
      await this.pingRepo.save(ping);

      // Fire outbound buyer pings — highest external bidder can also acquire
      // this lead (e.g. non-exclusive or as an additional sale channel)
      void this.outboundPingService.pingAll(lead).catch(() => {
        /* logged internally */
      });

      return {
        accepted: true,
        post_id: post.id,
        lead_id: lead.id,
        assignment_id: assignment.id,
        buyer_id: ping.matched_buyer.id,
        price_cents: assignment.amount_charged_cents,
        status: "accepted",
      };
    } catch (error) {
      post.status = "failed";
      post.error_message =
        error instanceof Error ? error.message : "assignment_failed";
      await this.postRepo.save(post);
      lead.status = LeadStatus.ARCHIVED;
      await this.leadRepo.save(lead);
      throw error;
    }
  }

  /**
   * Single-call lead submission (Juiced-compatible). Skips the ping → post
   * round trip: validates like a ping, then creates the lead directly in
   * the marketplace (status AVAILABLE) and runs auto-distribution +
   * outbound buyer pings. No wallet charge happens here.
   */
  async receiveDirectLead(
    apiKey: string | undefined,
    dto: VendorDirectLeadDto,
  ) {
    const vendor = await this.authenticateVendor(apiKey);
    this.assertAllowedSource(vendor, dto.source);

    const vendorLeadId =
      dto.vendor_lead_id?.trim() || dto.vendor_ping_id?.trim() || randomUUID();

    const duplicate = await this.findDuplicateLead({
      phone: dto.phone ?? dto.metadata?.phone,
      email: dto.email ?? dto.metadata?.email,
      address:
        dto.fulladdress ??
        dto.address ??
        dto.address_1 ??
        dto.metadata?.address,
      zip: dto.zip ?? dto.Zip,
    });

    if (duplicate) {
      await this.hitRepo.save(
        this.hitRepo.create({
          vendor_id: vendor.id,
          lead_id: duplicate.id,
          status: "rejected",
          rejection_reason: "duplicate_lead",
          ip_address: null,
          payload_snapshot: dto as Record<string, unknown>,
        }),
      );

      // Still attempt outbound buyer pings for the existing duplicate lead
      // so it can be offered to the highest external bidder
      void this.outboundPingService.pingAll(duplicate).catch(() => {
        /* logged internally */
      });

      return {
        accepted: false,
        status: "rejected",
        error: "duplicate_lead",
        duplicate_lead_id: duplicate.id,
      };
    }

    const leadType =
      this.clean(dto.lead_type ?? dto.leadType) ?? "motivated_seller";
    const market = this.marketFromDto(dto);
    const propertyType = this.clean(
      dto.property_type ?? dto.Propertytype ?? dto.propertyType,
    );
    const sellerName =
      dto.seller_name?.trim() ||
      [dto.first_name, dto.last_name].filter(Boolean).join(" ") ||
      "Unknown";
    const address =
      dto.address?.trim() ||
      dto.fulladdress?.trim() ||
      [dto.address_1, dto.address_2].filter(Boolean).join(", ") ||
      "";

    const { exclusive, shared } =
      await this.leadPricingConfigService.getPricesForLead(leadType);
    const exclusivityChoice = dto.exclusivity_choice ?? "non_exclusive";

    const metadata = {
      ...(dto.metadata ?? {}),

      // ── Seller identity ────────────────────────────────────────────────────
      seller_name: sellerName,
      first_name: dto.first_name ?? null,
      last_name: dto.last_name ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,

      // ── Property address ───────────────────────────────────────────────────
      address,
      address_1: dto.address_1 ?? null,
      address_2: dto.address_2 ?? null,
      fulladdress: dto.fulladdress ?? null,
      city: this.clean(dto.city),
      state: this.clean(dto.state)?.toUpperCase() ?? null,
      zip: this.clean(dto.zip ?? dto.Zip),
      county: this.clean(dto.county),

      // ── Property details ───────────────────────────────────────────────────
      property_type: propertyType,
      listed: dto.listed ?? null,
      howsoontosell: dto.howsoontosell ?? dto.timeline ?? null,
      reasonforselling: dto.reasonforselling ?? dto.reason ?? null,
      property_condition: dto.property_condition ?? dto.condition ?? null,
      asking_price_cents: dto.asking_price_cents ?? null,
      motivation_tags: dto.motivation_tags ?? [],

      // ── Attribution & compliance ───────────────────────────────────────────
      vendor: dto.vendor ?? vendor.name,
      referrer: dto.referrer ?? null,
      IP_Address: dto.IP_Address ?? null,
      TrustedForm: dto.TrustedForm ?? dto.xxTrustedFormCertUrl ?? null,
      submitted_at: dto.submitted_at ?? null,

      // ── Notes & IDs ────────────────────────────────────────────────────────
      notes: dto.notes ?? null,
      vendor_lead_id: vendorLeadId,
    };

    const lead = this.leadRepo.create({
      external_id: vendorLeadId,
      source: this.clean(dto.source) ?? "vendor_direct",
      market,
      lead_type: leadType,
      status: LeadStatus.AVAILABLE,
      exclusivity_level:
        exclusivityChoice === "exclusive"
          ? ExclusivityLevel.EXCLUSIVE
          : ExclusivityLevel.SHARED,
      quality_score: dto.quality_score ?? 70,
      price_cents: exclusive,
      list_price_anchor_cents: exclusive,
      exclusive_price_cents: exclusive,
      shared_price_cents: exclusivityChoice === "exclusive" ? null : shared,
      max_non_exclusive_buyers: exclusivityChoice === "exclusive" ? 1 : 3,
      title: `${leadType} lead in ${market}`,
      metadata,
      canonical_lead_source: vendor.id,
      utm: dto.referrer ? { source: dto.referrer } : {},
      early_access_until: null,
    });

    const saved = await this.leadRepo.save(lead);
    const priced = await this.leadPricingService.applyTierToLead(saved);

    await this.hitRepo.save(
      this.hitRepo.create({
        vendor_id: vendor.id,
        lead_id: priced.id,
        status: "accepted",
        ip_address: null,
        payload_snapshot: dto as Record<string, unknown>,
      }),
    );

    // Enqueue auto-distribution to buyers who match this lead's criteria
    void this.distributionService
      .enqueueLeadDistribution(priced.id)
      .catch(() => {
        /* logged internally */
      });

    // Fire outbound buyer pings (e.g. Juiced) — highest bidder wins
    void this.outboundPingService.pingAll(priced).catch(() => {
      /* logged internally */
    });

    return {
      accepted: true,
      lead_id: priced.id,
      vendor_lead_id: vendorLeadId,
      market: priced.market,
      lead_type: priced.lead_type,
      status: priced.status,
      exclusivity_level: priced.exclusivity_level,
      exclusive_price_cents: priced.exclusive_price_cents,
      shared_price_cents: priced.shared_price_cents,
    };
  }

  listPricingRules(userId: string) {
    return this.pricingRuleRepo.find({
      where: { user: { id: userId } },
      order: { priority: "DESC", created_at: "ASC" },
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
      throw new ForbiddenException("Not your pricing rule");
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
    if (dto.property_types !== undefined)
      rule.property_types = dto.property_types;
    if (dto.lead_types !== undefined) rule.lead_types = dto.lead_types;
    if (dto.fixed_price_cents !== undefined) {
      rule.fixed_price_cents =
        dto.fixed_price_cents === null ? null : String(dto.fixed_price_cents);
    }
    if (dto.max_bid_cents !== undefined) {
      rule.max_bid_cents =
        dto.max_bid_cents === null ? null : String(dto.max_bid_cents);
    }
    if (dto.exclusivity_preference !== undefined)
      rule.exclusivity_preference = dto.exclusivity_preference;
    if (dto.routing_strategy !== undefined)
      rule.routing_strategy = dto.routing_strategy;

    return this.pricingRuleRepo.save(rule);
  }

  async deletePricingRule(userId: string, id: string) {
    const rule = await this.pricingRuleRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!rule) throw new NotFoundException("Pricing rule not found");
    if (rule.user.id !== userId)
      throw new ForbiddenException("Not your pricing rule");
    await this.pricingRuleRepo.delete(id);
    return { ok: true };
  }

  listVendors() {
    return this.vendorRepo.find({ order: { created_at: "DESC" } });
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
    if (!vendor) throw new NotFoundException("Vendor not found");
    if (dto.name !== undefined) vendor.name = dto.name;
    if (dto.api_key !== undefined)
      vendor.api_key_hash = this.hashApiKey(dto.api_key);
    if (dto.enabled !== undefined) vendor.enabled = dto.enabled;
    if (dto.allowed_sources !== undefined)
      vendor.allowed_sources = dto.allowed_sources;
    if (dto.ping_timeout_ms !== undefined)
      vendor.ping_timeout_ms = dto.ping_timeout_ms;
    if (dto.ping_ttl_seconds !== undefined)
      vendor.ping_ttl_seconds = dto.ping_ttl_seconds;
    if (dto.metadata !== undefined) vendor.metadata = dto.metadata;
    return this.vendorRepo.save(vendor);
  }

  async listPings(limit = 50) {
    return this.pingRepo.find({
      relations: {
        vendor: true,
        matched_buyer: true,
        matched_pricing_rule: true,
      },
      order: { created_at: "DESC" },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async getPing(id: string) {
    const ping = await this.pingRepo.findOne({
      where: { id },
      relations: {
        vendor: true,
        matched_buyer: true,
        matched_pricing_rule: true,
      },
    });
    if (!ping) throw new NotFoundException("Ping not found");
    const audit = await this.auditRepo.find({
      where: { ping: { id } },
      relations: { buyer: true, pricing_rule: true },
      order: { created_at: "ASC" },
    });
    return { ping, audit };
  }

  private async authenticateVendor(apiKey: string | undefined) {
    if (!apiKey) throw new UnauthorizedException("Missing vendor API key");
    const vendor = await this.vendorRepo.findOne({
      where: { api_key_hash: this.hashApiKey(apiKey), enabled: true },
    });
    if (!vendor) throw new UnauthorizedException("Invalid vendor API key");
    return vendor;
  }

  private async createPostedLead(
    ping: LeadPing,
    dto: VendorPostDto,
  ): Promise<Lead> {
    // ── Derive canonical fields from vendor's various naming conventions ──────
    const sellerName =
      dto.seller_name?.trim() ||
      [dto.first_name, dto.last_name].filter(Boolean).join(" ") ||
      "Unknown";

    const address =
      dto.address?.trim() ||
      dto.fulladdress?.trim() ||
      [dto.address_1, dto.address_2].filter(Boolean).join(", ") ||
      "";

    // Post-level location overrides ping-level if provided
    const city = this.clean(dto.city) ?? ping.city;
    const state = this.clean(dto.state)?.toUpperCase() ?? ping.state;
    const zip = this.clean(dto.zip ?? dto.Zip) ?? ping.zip;
    const propertyType =
      this.clean(dto.property_type ?? dto.Propertytype) ?? ping.property_type;

    const market = ping.market ?? this.marketFromParts(city, state, zip);

    const metadata = {
      // base: whatever was in the ping payload
      ...(ping.payload ?? {}),
      // extra metadata bag from vendor
      ...(dto.metadata ?? {}),

      // ── Seller identity ────────────────────────────────────────────────────
      seller_name: sellerName,
      first_name: dto.first_name ?? null,
      last_name: dto.last_name ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,

      // ── Property address ───────────────────────────────────────────────────
      address,
      address_1: dto.address_1 ?? null,
      address_2: dto.address_2 ?? null,
      fulladdress: dto.fulladdress ?? null,
      city,
      state,
      zip,
      county: ping.county,

      // ── Property details ───────────────────────────────────────────────────
      property_type: propertyType,
      listed: dto.listed ?? null,
      howsoontosell: dto.howsoontosell ?? null,
      reasonforselling: dto.reasonforselling ?? null,
      property_condition: dto.property_condition ?? null,

      // ── Attribution & compliance ───────────────────────────────────────────
      vendor: dto.vendor ?? null,
      referrer: dto.referrer ?? null,
      IP_Address: dto.IP_Address ?? null,
      TrustedForm: dto.TrustedForm ?? null,

      // ── Notes & IDs ────────────────────────────────────────────────────────
      notes: dto.notes ?? null,
      vendor_ping_id: ping.vendor_ping_id,
      vendor_lead_id: dto.vendor_lead_id,
    };

    // Pricing always from admin-controlled config — ignore vendor bid for lead price display
    const { exclusive: sysExclusive, shared: sysShared } =
      await this.leadPricingConfigService.getPricesForLead(
        ping.lead_type ?? "inbound",
      );

    const lead = this.leadRepo.create({
      external_id: dto.vendor_lead_id,
      source: ping.source ?? "vendor_ping",
      market,
      lead_type: ping.lead_type,
      status: LeadStatus.AVAILABLE,
      exclusivity_level:
        ping.exclusivity_choice === "exclusive"
          ? ExclusivityLevel.EXCLUSIVE
          : ExclusivityLevel.SHARED,
      quality_score: dto.quality_score ?? 70,
      price_cents: sysExclusive,
      exclusive_price_cents: sysExclusive,
      shared_price_cents:
        ping.exclusivity_choice === "exclusive" ? null : sysShared,
      max_non_exclusive_buyers: ping.exclusivity_choice === "exclusive" ? 1 : 3,
      title: `${ping.lead_type} lead in ${market}`,
      metadata,
      canonical_lead_source: ping.source ?? "vendor_ping",
      utm: dto.referrer ? { source: dto.referrer } : {},
      early_access_until: null,
    });

    const saved = await this.leadRepo.save(lead);
    return this.leadPricingService.applyTierToLead(saved);
  }

  // Duplicate detection now lives in the shared LeadDedupService so every
  // entry path (ping / post / direct / inbound / CSV bulk import) applies the
  // exact same match rule. This wrapper keeps the existing call sites intact.
  private async findDuplicateLead(input: {
    phone?: unknown;
    email?: unknown;
    address?: unknown;
    zip?: unknown;
  }) {
    return this.leadDedupService.findDuplicate(input);
  }

  private toPingResponse(ping: LeadPing) {
    return {
      accepted: ping.status === "accepted" || ping.status === "posted",
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
    if (
      !vendor.allowed_sources ||
      vendor.allowed_sources.length === 0 ||
      !source
    )
      return;
    const allowed = vendor.allowed_sources.map((s) => s.trim().toLowerCase());
    if (!allowed.includes(source.trim().toLowerCase())) {
      throw new ForbiddenException("Vendor source is not allowed");
    }
  }

  private hashApiKey(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex");
  }

  private marketFromDto(dto: VendorPingDto): string {
    if (dto.market?.trim()) return dto.market.trim();
    return this.marketFromParts(dto.city, dto.state, dto.zip ?? dto.Zip);
  }

  private marketFromParts(
    city?: string | null,
    state?: string | null,
    zip?: string | null,
  ): string {
    const cityState = [this.clean(city), this.clean(state)?.toUpperCase()]
      .filter(Boolean)
      .join(", ");
    return cityState || this.clean(zip) || "Unknown market";
  }

  private clean(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null;
  }
}
