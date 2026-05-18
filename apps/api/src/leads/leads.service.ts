import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { LeadPriceHistory } from '../entities/lead-price-history.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { LeadAssignmentEvent } from '../entities/lead-assignment-event.entity';
import { Subscription } from '../entities/subscription.entity';
import { WalletTransactionType } from '../../common/enums/wallet-transaction-type.enum';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { PurchaseType } from '../../common/enums/purchase-type.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { AppendPriceHistoryDto } from './dto/append-price-history.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { ListMarketplaceLeadsDto } from './dto/list-marketplace-leads.dto';
import { ListMyLeadsDto } from './dto/list-my-leads.dto';
import { WalletService } from '../wallet/wallet.service';
import { WalletAccount } from '../entities/wallet-account.entity';
import { DistributionService } from '../distribution/distribution.service';
import { LeadPricingService } from './lead-pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExclusivityLevel } from '../../common/enums/exclusivity-level.enum';
import { redactLeadMetadata } from './lead-redaction.util';
import { IntegrationsService } from '../integrations/integrations.service';
import { ProEntitlementService } from '../subscriptions/pro-entitlement.service';
import { DistributionRule } from '../entities/distribution-rule.entity';

export type ExclusivityChoice = 'exclusive' | 'non_exclusive';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(LeadPriceHistory)
    private readonly leadPriceHistoryRepo: Repository<LeadPriceHistory>,
    @InjectRepository(WalletTransaction)
    private readonly walletTransactionRepo: Repository<WalletTransaction>,
    @InjectRepository(LeadAssignment)
    private readonly leadAssignmentRepo: Repository<LeadAssignment>,
    @InjectRepository(LeadAssignmentEvent)
    private readonly assignmentEventRepo: Repository<LeadAssignmentEvent>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(DistributionRule)
    private readonly distributionRuleRepo: Repository<DistributionRule>,
    private readonly dataSource: DataSource,
    private readonly walletService: WalletService,
    private readonly distributionService: DistributionService,
    private readonly leadPricingService: LeadPricingService,
    private readonly notificationsService: NotificationsService,
    private readonly integrationsService: IntegrationsService,
    private readonly config: ConfigService,
    private readonly proEntitlementService: ProEntitlementService,
  ) {}

  private getExclusivePriceCents(lead: Pick<Lead, 'exclusive_price_cents' | 'price_cents'>): bigint {
    return BigInt(lead.exclusive_price_cents ?? lead.price_cents);
  }

  private getSharedCap(lead: Pick<Lead, 'max_non_exclusive_buyers'>): number {
    return Math.max(1, Number(lead.max_non_exclusive_buyers ?? 3));
  }

  /**
   * Canonical shared-per-buyer pricing: shared = exclusive / cap.
   * This is the single source used by quote + purchase charging.
   */
  private getSharedPriceCents(
    lead: Pick<Lead, 'exclusive_price_cents' | 'price_cents' | 'max_non_exclusive_buyers'>,
  ): bigint {
    const exclusive = this.getExclusivePriceCents(lead);
    const cap = BigInt(this.getSharedCap(lead));
    const computed = exclusive / cap;
    return computed > 0n ? computed : 1n;
  }

  private normalizeContactValue(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private async detectCanonicalDuplicate(
    metadata: Record<string, unknown>,
    excludeLeadId?: string,
  ): Promise<Lead | null> {
    const normalizedPhone = this.normalizeContactValue(metadata.phone);
    const normalizedEmail = this.normalizeContactValue(metadata.email);
    if (!normalizedPhone && !normalizedEmail) {
      return null;
    }

    const qb = this.leadRepo
      .createQueryBuilder('lead')
      .orderBy('lead.created_at', 'ASC')
      .take(1);

    if (excludeLeadId) {
      qb.where('lead.id != :excludeLeadId', { excludeLeadId });
    }

    const clauses: string[] = [];
    const params: Record<string, string> = {};
    if (normalizedPhone) {
      clauses.push(`LOWER(TRIM(COALESCE(lead.metadata->>'phone',''))) = :normalizedPhone`);
      params.normalizedPhone = normalizedPhone;
    }
    if (normalizedEmail) {
      clauses.push(`LOWER(TRIM(COALESCE(lead.metadata->>'email',''))) = :normalizedEmail`);
      params.normalizedEmail = normalizedEmail;
    }
    if (clauses.length === 0) return null;
    qb.andWhere(`(${clauses.join(' OR ')})`, params);
    return qb.getOne();
  }

  async createLead(dto: CreateLeadDto) {
    const { utm, canonical_lead_source, ...rest } = dto;
    const duplicateOf = await this.detectCanonicalDuplicate(dto.metadata ?? {});

    const earlyAccessMinutes: number =
      (dto as any).early_access_minutes ?? 60;
    const earlyAccessUntil = new Date(
      Date.now() + earlyAccessMinutes * 60 * 1000,
    );

    const exclusivePriceCents =
      (dto as any).exclusive_price_cents != null
        ? String((dto as any).exclusive_price_cents)
        : dto.price_cents.toString();

    const sharedPriceCents =
      (dto as any).shared_price_cents != null
        ? String((dto as any).shared_price_cents)
        : dto.price_cents.toString();

    const lead = this.leadRepo.create({
      ...rest,
      external_id: dto.external_id ?? null,
      metadata: dto.metadata ?? {},
      utm: utm ?? {},
      canonical_lead_source: canonical_lead_source ?? null,
      duplicate_of_lead: duplicateOf,
      price_cents: dto.price_cents.toString(),
      exclusive_price_cents: exclusivePriceCents,
      shared_price_cents: sharedPriceCents,
      max_non_exclusive_buyers: (dto as any).max_non_exclusive_buyers ?? 3,
      early_access_until: earlyAccessUntil,
    });

    const savedLead = await this.leadRepo.save(lead);
    await this.leadPricingService.applyTierToLead(savedLead);
    await this.notificationsService.notifyMarketAlertsForLead(
      {
        id: savedLead.id,
        title: savedLead.title,
        market: savedLead.market,
        lead_type: savedLead.lead_type,
        exclusivity_level: savedLead.exclusivity_level,
        price_cents: savedLead.price_cents,
        state: (savedLead.metadata as any)?.state ?? null,
        source: savedLead.source ?? null,
      },
      earlyAccessMinutes,
    );
    await this.distributionService.enqueueLeadDistribution(savedLead.id);
    return (
      (await this.leadRepo.findOne({ where: { id: savedLead.id } })) ?? savedLead
    );
  }

  async updateLead(id: string, dto: UpdateLeadDto) {
    const lead = await this.findLeadOrThrow(id);

    if (dto.price_cents !== undefined) {
      lead.price_cents = dto.price_cents.toString();
    }

    if (dto.external_id !== undefined) {
      lead.external_id = dto.external_id ?? null;
    }

    if (dto.metadata !== undefined) {
      lead.metadata = dto.metadata;
    }

    if (dto.source !== undefined) {
      lead.source = dto.source;
    }

    if (dto.market !== undefined) {
      lead.market = dto.market;
    }

    if (dto.lead_type !== undefined) {
      lead.lead_type = dto.lead_type;
    }

    if (dto.status !== undefined) {
      lead.status = dto.status;
    }

    if (dto.exclusivity_level !== undefined) {
      lead.exclusivity_level = dto.exclusivity_level;
    }

    if (dto.quality_score !== undefined) {
      lead.quality_score = dto.quality_score;
    }

    if (dto.title !== undefined) {
      lead.title = dto.title;
    }

    if ((dto as any).exclusive_price_cents !== undefined) {
      lead.exclusive_price_cents = String((dto as any).exclusive_price_cents);
    }
    if ((dto as any).shared_price_cents !== undefined) {
      lead.shared_price_cents = String((dto as any).shared_price_cents);
    }
    if ((dto as any).max_non_exclusive_buyers !== undefined) {
      lead.max_non_exclusive_buyers = (dto as any).max_non_exclusive_buyers;
    }

    await this.leadRepo.save(lead);
    const tierFieldsChanged =
      dto.quality_score !== undefined ||
      dto.exclusivity_level !== undefined ||
      dto.market !== undefined;
    if (tierFieldsChanged) {
      await this.leadPricingService.applyTierToLead(
        (await this.findLeadOrThrow(id)) as Lead,
      );
    }
    return this.findLeadOrThrow(id);
  }

  async archiveLead(id: string) {
    const lead = await this.findLeadOrThrow(id);
    lead.status = LeadStatus.ARCHIVED;
    return this.leadRepo.save(lead);
  }

  async appendPriceHistory(id: string, dto: AppendPriceHistoryDto) {
    const lead = await this.findLeadOrThrow(id);
    const oldPrice = lead.price_cents;

    const history = this.leadPriceHistoryRepo.create({
      lead,
      old_price_cents: oldPrice,
      new_price_cents: dto.new_price_cents.toString(),
      reason: dto.reason,
    });

    lead.price_cents = dto.new_price_cents.toString();

    await this.leadRepo.save(lead);
    await this.leadPriceHistoryRepo.save(history);
    await this.leadPricingService.applyTierToLead(
      (await this.findLeadOrThrow(id)) as Lead,
    );
    return history;
  }

  async listLeads(query: ListLeadsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const qb = this.leadRepo
      .createQueryBuilder('lead')
      .orderBy('lead.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.market) {
      qb.andWhere('lead.market = :market', { market: query.market });
    }

    if (query.type) {
      qb.andWhere('lead.lead_type = :leadType', { leadType: query.type });
    }

    if (query.status) {
      qb.andWhere('lead.status = :status', { status: query.status });
    }

    if ((query as any).source) {
      qb.andWhere('lead.source = :src', { src: (query as any).source });
    }

    if ((query as any).date_from) {
      const df = new Date((query as any).date_from as string);
      qb.andWhere('lead.created_at >= :df', { df });
    }

    const [items, total] = await qb.getManyAndCount();

    const leadIds = items.map((l) => l.id);
    const assignments =
      leadIds.length > 0
        ? await this.leadAssignmentRepo
            .createQueryBuilder('a')
            .leftJoin('a.buyer', 'buyer')
            .select('a.lead_id', 'lead_id')
            .addSelect('buyer.email', 'buyer_email')
            .addSelect('a.purchase_type', 'purchase_type')
            .where('a.lead_id IN (:...ids)', { ids: leadIds })
            .getRawMany<{ lead_id: string; buyer_email: string; purchase_type: string }>()
        : [];

    const buyerMap = new Map<string, string[]>();
    for (const a of assignments) {
      const list = buyerMap.get(a.lead_id) ?? [];
      if (a.buyer_email) list.push(a.buyer_email);
      buyerMap.set(a.lead_id, list);
    }

    return {
      items: items.map((lead) => ({
        ...lead,
        buyers: buyerMap.get(lead.id) ?? [],
      })),
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async getLeadById(id: string): Promise<Lead> {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async deleteLead(id: string): Promise<{ ok: boolean; archived: boolean }> {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    const hasAssignments = await this.leadAssignmentRepo.exists({ where: { lead: { id } } });
    if (hasAssignments) {
      lead.status = LeadStatus.ARCHIVED;
      await this.leadRepo.save(lead);
      return { ok: true, archived: true };
    }

    await this.leadRepo.delete({ id });
    return { ok: true, archived: false };
  }

  async listMarketplaceLeads(query: ListMarketplaceLeadsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const qb = this.leadRepo
      .createQueryBuilder('lead')
      .where('lead.status = :status', { status: LeadStatus.AVAILABLE })
      .orderBy('lead.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.market) {
      qb.andWhere('lead.market = :market', { market: query.market });
    }

    if (query.type) {
      qb.andWhere('lead.lead_type = :leadType', { leadType: query.type });
    }

    // multi-state: frontend sends comma-separated state codes
    if (query.state?.trim()) {
      const stateList = query.state.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (stateList.length === 1) {
        qb.andWhere(`LOWER(COALESCE(lead.metadata->>'state', '')) LIKE :stateVal`, {
          stateVal: `%${stateList[0]}%`,
        });
      } else if (stateList.length > 1) {
        const stateConditions = stateList.map((s, i) => `LOWER(COALESCE(lead.metadata->>'state', '')) LIKE :sv${i}`);
        const stateParams = Object.fromEntries(stateList.map((s, i) => [`sv${i}`, `%${s}%`]));
        qb.andWhere(`(${stateConditions.join(' OR ')})`, stateParams);
      }
    }

    const metadataFilters: Array<[string, string | undefined]> = [
      ['city', query.city],
      ['property_type', query.property_type],
      ['timeline', query.timeline],
      ['condition', query.condition],
      ['zip', query.zip],
    ];
    metadataFilters.forEach(([key, value], idx) => {
      const trimmed = value?.trim();
      if (!trimmed) return;
      qb.andWhere(`LOWER(COALESCE(lead.metadata->>'${key}', '')) LIKE :mv${idx}`, {
        [`mv${idx}`]: `%${trimmed.toLowerCase()}%`,
      });
    });

    if (query.exclusivity) {
      qb.andWhere('lead.exclusivity_level = :exclusivity', {
        exclusivity: query.exclusivity,
      });
    }

    if (query.minPrice !== undefined) {
      qb.andWhere('lead.price_cents >= :minPrice', {
        minPrice: query.minPrice.toString(),
      });
    }

    if (query.maxPrice !== undefined) {
      qb.andWhere('lead.price_cents <= :maxPrice', {
        maxPrice: query.maxPrice.toString(),
      });
    }

    if (query.maxAgeDays !== undefined) {
      const cutoff = new Date(
        Date.now() - Number(query.maxAgeDays) * 24 * 60 * 60 * 1000,
      );
      qb.andWhere('lead.created_at >= :cutoff', { cutoff });
    }

    // Marketplace v2: filter on the active purchase modes, not legacy marketplace labels.
    if (query.exclusivity_filter === 'exclusive_only') {
      qb.andWhere('lead.exclusivity_level = :excl', {
        excl: ExclusivityLevel.EXCLUSIVE,
      });
    } else if (query.exclusivity_filter === 'non_exclusive_only') {
      qb.andWhere('lead.exclusivity_level != :excl', {
        excl: ExclusivityLevel.EXCLUSIVE,
      });
    }

    if (query.source) {
      qb.andWhere('lead.source = :src', { src: query.source });
    }

    if (query.date_from) {
      const df = new Date(query.date_from);
      qb.andWhere('lead.created_at >= :df', { df });
    }
    if (query.date_to) {
      const dt = new Date(query.date_to);
      dt.setHours(23, 59, 59, 999);
      qb.andWhere('lead.created_at <= :dt', { dt });
    }

    qb.select([
      'lead.id',
      'lead.market',
      'lead.lead_type',
      'lead.exclusivity_level',
      'lead.quality_score',
      'lead.price_cents',
      'lead.created_at',
      'lead.title',
      'lead.metadata',
      'lead.marketplace_tier',
      'lead.list_price_anchor_cents',
      'lead.exclusive_price_cents',
      'lead.shared_price_cents',
      'lead.max_non_exclusive_buyers',
      'lead.non_exclusive_buyers_count',
      'lead.early_access_until',
    ]);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((lead) => ({
        id: lead.id,
        title: lead.title,
        market: lead.market,
        type: lead.lead_type,
        exclusivity: lead.exclusivity_level,
        quality_score: lead.quality_score,
        current_price: lead.price_cents,
        list_price_anchor_cents: lead.list_price_anchor_cents,
        marketplace_tier: lead.marketplace_tier,
        exclusive_price_cents: lead.exclusive_price_cents,
        shared_price_cents: lead.shared_price_cents,
        max_non_exclusive_buyers: lead.max_non_exclusive_buyers,
        non_exclusive_buyers_count: lead.non_exclusive_buyers_count,
        early_access_until: lead.early_access_until,
        metadata: redactLeadMetadata(lead.metadata ?? {}),
        created_at: lead.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  /**
   * Returns the effective price a specific user would pay for a lead, after
   * applying any Pro discount.  Used by the frontend "quote" modal.
   */
  /**
   * Applies a percentage discount to both exclusive_price_cents and
   * shared_price_cents, writing a LeadPriceHistory record for each changed
   * price. Also updates the legacy price_cents to match exclusive price.
   */
  async applyPriceDiscount(id: string, percent: number, until?: string) {
    const lead = await this.findLeadOrThrow(id);
    const pct = Math.min(99, Math.max(1, percent));
    const multiplier = BigInt(100 - pct);

    const oldExclusive = BigInt(lead.exclusive_price_cents ?? lead.price_cents);
    const oldShared = BigInt(lead.shared_price_cents ?? lead.price_cents);

    const newExclusive = (oldExclusive * multiplier) / 100n;
    const newShared = (oldShared * multiplier) / 100n;
    const reason = `Admin discount (${pct}%)${until ? ` until ${until}` : ''}`;

    const histories = [
      this.leadPriceHistoryRepo.create({
        lead,
        old_price_cents: oldExclusive.toString(),
        new_price_cents: newExclusive.toString(),
        reason: `${reason} [exclusive]`,
      }),
      this.leadPriceHistoryRepo.create({
        lead,
        old_price_cents: oldShared.toString(),
        new_price_cents: newShared.toString(),
        reason: `${reason} [shared]`,
      }),
    ];

    lead.exclusive_price_cents = newExclusive.toString();
    lead.shared_price_cents = newShared.toString();
    lead.price_cents = newExclusive.toString(); // keep legacy field in sync

    await this.leadRepo.save(lead);
    await this.leadPriceHistoryRepo.save(histories);
    await this.leadPricingService.applyTierToLead(
      (await this.findLeadOrThrow(id)) as Lead,
    );
    return { exclusive_price_cents: newExclusive.toString(), shared_price_cents: newShared.toString() };
  }

  /**
   * Applies a percentage boost (increase) to both exclusive and shared prices.
   * Used by admin to temporarily raise price on high-demand leads.
   */
  async applyPriceBoost(id: string, percent: number) {
    const lead = await this.findLeadOrThrow(id);
    const pct = Math.min(500, Math.max(1, percent));
    const multiplier = BigInt(100 + pct);

    const oldExclusive = BigInt(lead.exclusive_price_cents ?? lead.price_cents);
    const oldShared = BigInt(lead.shared_price_cents ?? lead.price_cents);

    const newExclusive = (oldExclusive * multiplier) / 100n;
    const newShared = (oldShared * multiplier) / 100n;
    const reason = `Admin boost (+${pct}%)`;

    const histories = [
      this.leadPriceHistoryRepo.create({
        lead,
        old_price_cents: oldExclusive.toString(),
        new_price_cents: newExclusive.toString(),
        reason: `${reason} [exclusive]`,
      }),
      this.leadPriceHistoryRepo.create({
        lead,
        old_price_cents: oldShared.toString(),
        new_price_cents: newShared.toString(),
        reason: `${reason} [shared]`,
      }),
    ];

    lead.exclusive_price_cents = newExclusive.toString();
    lead.shared_price_cents = newShared.toString();
    lead.price_cents = newExclusive.toString();

    await this.leadRepo.save(lead);
    await this.leadPriceHistoryRepo.save(histories);
    await this.leadPricingService.applyTierToLead(
      (await this.findLeadOrThrow(id)) as Lead,
    );
    return { exclusive_price_cents: newExclusive.toString(), shared_price_cents: newShared.toString() };
  }

  async getLeadQuote(
    userId: string,
    leadId: string,
    choice: ExclusivityChoice,
  ): Promise<{
    exclusive_price_cents: string;
    shared_price_cents: string;
    effective_price_cents: string;
    is_pro: boolean;
    early_access_until: Date | null;
    can_buy_now: boolean;
  }> {
    const lead = await this.findLeadOrThrow(leadId);

    const exclusiveRaw = this.getExclusivePriceCents(lead);
    const sharedRaw = this.getSharedPriceCents(lead);

    const [isPro, canBuyNow] = await Promise.all([
      this.proEntitlementService.isPro(userId),
      this.proEntitlementService.canBuyDuringEarlyAccess(userId, lead),
    ]);

    const rawPrice = choice === 'exclusive' ? exclusiveRaw : sharedRaw;
    const effectivePrice = await this.proEntitlementService.discountedPriceCents(
      userId,
      rawPrice,
    );

    return {
      exclusive_price_cents: exclusiveRaw.toString(),
      shared_price_cents: sharedRaw.toString(),
      effective_price_cents: effectivePrice.toString(),
      is_pro: isPro,
      early_access_until: lead.early_access_until,
      can_buy_now: canBuyNow,
    };
  }

  async getAdminMetrics() {
    const statusRows = await this.leadRepo
      .createQueryBuilder('lead')
      .select('lead.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('lead.status')
      .getRawMany<{ status: LeadStatus; count: string }>();

    const walletDepositsRaw = await this.walletTransactionRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount_cents), 0)', 'sum')
      .where('tx.type = :credit', { credit: WalletTransactionType.CREDIT })
      .andWhere("tx.reference_type != 'refund_approved'")
      .getRawOne<{ sum: string }>();

    const totalRevenueRaw = await this.leadAssignmentRepo
      .createQueryBuilder('assignment')
      .select('COALESCE(SUM(assignment.amount_charged_cents), 0)', 'sum')
      .where("COALESCE(assignment.disposition, '') != 'refunded'")
      .getRawOne<{ sum: string }>();

    const countByStatus = statusRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});

    return {
      countByStatus,
      totalWalletDepositsCents: walletDepositsRaw?.sum ?? '0',
      totalRevenueCents: totalRevenueRaw?.sum ?? '0',
    };
  }

  async getAdminMetricsExtended() {
    const base = await this.getAdminMetrics();
    const activeSubscriptions = await this.subscriptionRepo.count({
      where: { status: SubscriptionStatus.ACTIVE },
    });
    const availableLeads = await this.leadRepo.count({
      where: { status: LeadStatus.AVAILABLE },
    });
    const autoDistributionParticipants = await this.distributionRuleRepo.count({
      where: { participation_enabled: true, is_active: true },
    });
    const [buyersRaw, activeAssignmentCount] = await Promise.all([
      this.leadAssignmentRepo
        .createQueryBuilder('a')
        .select('COUNT(DISTINCT a.buyer_id)', 'c')
        .where("COALESCE(a.disposition, '') != 'refunded'")
        .getRawOne<{ c: string }>(),
      this.leadAssignmentRepo
        .createQueryBuilder('a')
        .where("COALESCE(a.disposition, '') != 'refunded'")
        .getCount(),
    ]);
    return {
      ...base,
      activeSubscriptions,
      distinctBuyers: Number(buyersRaw?.c ?? 0),
      totalAssignments: activeAssignmentCount,
      availableLeads,
      autoDistributionParticipants,
    };
  }

  async getMyLeads(userId: string, query: ListMyLeadsDto) {
    const safePage = Math.max(1, query.page ?? 1);
    const safeLimit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (safePage - 1) * safeLimit;

    const baseQb = () => {
      const qb = this.leadAssignmentRepo
        .createQueryBuilder('assignment')
        .leftJoin('assignment.lead', 'lead')
        .where('assignment.buyer_id = :userId', { userId })
        .andWhere(
          "COALESCE(assignment.disposition, '') != 'refunded'",
        );

      if (query.purchaseType != null) {
        qb.andWhere('assignment.purchase_type = :purchaseType', {
          purchaseType: query.purchaseType,
        });
      }
      if (query.status != null) {
        qb.andWhere('lead.status = :leadStatus', { leadStatus: query.status });
      }
      if (query.lifecyclePhase != null) {
        qb.andWhere('assignment.lifecycle_phase = :lifecyclePhase', {
          lifecyclePhase: query.lifecyclePhase,
        });
      }
      if (query.dateFrom) {
        const df = new Date(query.dateFrom);
        df.setHours(0, 0, 0, 0);
        qb.andWhere('assignment.created_at >= :dateFrom', { dateFrom: df });
      }
      if (query.dateTo) {
        const dt = new Date(query.dateTo);
        dt.setHours(23, 59, 59, 999);
        qb.andWhere('assignment.created_at <= :dateTo', { dateTo: dt });
      }
      return qb;
    };

    const [rows, total] = await Promise.all([
      baseQb()
        .orderBy('assignment.created_at', 'DESC')
        .skip(skip)
        .take(safeLimit)
        .select([
          'assignment.id AS assignment_id',
          'lead.id AS lead_id',
          'lead.market AS market',
          'lead.lead_type AS type',
          'lead.exclusivity_level AS exclusivity',
          'assignment.amount_charged_cents AS charged_amount',
          'assignment.exclusivity_choice AS exclusivity_choice',
          'assignment.purchase_type AS purchase_type',
          'lead.status AS status',
          'assignment.ghl_sync_status AS ghl_sync_status',
          'assignment.crm_sync_status AS crm_sync_status',
          'assignment.created_at AS assigned_at',
          'assignment.lifecycle_phase AS lifecycle_phase',
          'assignment.contract_price_cents AS contract_price_cents',
          'assignment.sell_price_cents AS sell_price_cents',
          'assignment.buyer_notes AS buyer_notes',
        ])
        .getRawMany(),
      baseQb().getCount(),
    ]);

    return {
      items: rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
      },
    };
  }

  async getLeadDetail(leadId: string, userId: string, role: UserRole | string) {
    const lead = await this.leadRepo.findOne({
      where: { id: leadId },
      relations: { priceHistory: true },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const assignmentQb = this.leadAssignmentRepo
      .createQueryBuilder('assignment')
      .leftJoin('assignment.buyer', 'buyer')
      .where('assignment.lead_id = :leadId', { leadId })
      .orderBy('assignment.created_at', 'DESC')
      .select([
        'assignment.id AS assignment_id',
        'assignment.purchase_type AS purchase_type',
        'assignment.exclusivity_choice AS exclusivity_choice',
        'assignment.amount_charged_cents AS charged_amount',
        'assignment.ghl_sync_status AS ghl_sync_status',
        'assignment.crm_sync_status AS crm_sync_status',
        'assignment.created_at AS assigned_at',
        'assignment.lifecycle_phase AS lifecycle_phase',
        'assignment.disposition AS disposition',
        'assignment.contract_price_cents AS contract_price_cents',
        'assignment.sell_price_cents AS sell_price_cents',
        'assignment.buyer_notes AS buyer_notes',
        'buyer.id AS buyer_id',
        'buyer.email AS buyer_email',
      ]);

    if (role !== UserRole.ADMIN) {
      assignmentQb.andWhere('assignment.buyer_id = :userId', { userId });
    }

    const assignments = await assignmentQb.getRawMany();
    const revealPii =
      role === UserRole.ADMIN || (assignments as any[]).length > 0;
    const assignmentIds = assignments.map((a) => a.assignment_id as string);

    const timelineByAssignment: Record<string, any[]> = {};
    if (assignmentIds.length > 0) {
      const events = await this.assignmentEventRepo.find({
        where: { assignment: { id: In(assignmentIds) } },
        relations: { assignment: true },
        order: { created_at: 'ASC' },
      });
      for (const ev of events) {
        const aid = ev.assignment?.id;
        if (!aid) continue;
        if (!timelineByAssignment[aid]) timelineByAssignment[aid] = [];
        timelineByAssignment[aid].push({
          id: ev.id,
          event_type: ev.event_type,
          body: ev.body,
          created_at: ev.created_at,
        });
      }
    }

    return {
      lead: {
        id: lead.id,
        source: lead.source,
        market: lead.market,
        type: lead.lead_type,
        exclusivity: lead.exclusivity_level,
        quality_score: lead.quality_score,
        current_price: lead.price_cents,
        list_price_anchor_cents: lead.list_price_anchor_cents,
        marketplace_tier: lead.marketplace_tier,
        title: lead.title,
        status: lead.status,
        metadata: revealPii
          ? lead.metadata ?? {}
          : redactLeadMetadata(lead.metadata ?? {}),
        created_at: lead.created_at,
        updated_at: lead.updated_at,
      },
      lead_price_history: (lead.priceHistory || []).map((history) => ({
        id: history.id,
        old_price_cents: history.old_price_cents,
        new_price_cents: history.new_price_cents,
        reason: history.reason,
        changed_at: history.changed_at,
      })),
      lead_assignments: assignments.map((a) => ({
        ...a,
        timeline: timelineByAssignment[a.assignment_id as string] ?? [],
      })),
    };
  }

  private async findLeadOrThrow(id: string) {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async reserveLead(buyerId: string, leadId: string) {
    const ttlSec = Math.max(
      60,
      Number(this.config.get<string>('LEAD_RESERVE_TTL_SECONDS') ?? 900),
    );
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const lead = await queryRunner.manager
        .getRepository(Lead)
        .createQueryBuilder('lead')
        .setLock('pessimistic_write')
        .where('lead.id = :id', { id: leadId })
        .getOne();

      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.status !== LeadStatus.AVAILABLE) {
        throw new BadRequestException('Lead is not available to reserve');
      }

      const until = new Date(Date.now() + ttlSec * 1000);
      lead.status = LeadStatus.RESERVED;
      lead.reserved_until = until;
      lead.reserved_by_user = { id: buyerId } as any;
      await queryRunner.manager.save(lead);
      await queryRunner.commitTransaction();
      return { reserved_until: until.toISOString(), ttl_seconds: ttlSec };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async updateMyAssignmentLifecycle(
    userId: string,
    assignmentId: string,
    patch: {
      lifecycle_phase?: string;
      contract_price_cents?: number | null;
      sell_price_cents?: number | null;
      buyer_notes?: string | null;
    },
  ) {
    const assignment = await this.leadAssignmentRepo.findOne({
      where: { id: assignmentId },
      relations: { buyer: true, lead: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.buyer.id !== userId) {
      throw new ForbiddenException('Not your assignment');
    }
    if (patch.lifecycle_phase !== undefined) {
      assignment.lifecycle_phase = patch.lifecycle_phase;
    }
    if (patch.contract_price_cents !== undefined) {
      assignment.contract_price_cents =
        patch.contract_price_cents === null
          ? null
          : String(patch.contract_price_cents);
    }
    if (patch.sell_price_cents !== undefined) {
      assignment.sell_price_cents =
        patch.sell_price_cents === null ? null : String(patch.sell_price_cents);
    }
    if (patch.buyer_notes !== undefined) {
      assignment.buyer_notes = patch.buyer_notes;
    }
    await this.leadAssignmentRepo.save(assignment);
    await this.assignmentEventRepo.save(
      this.assignmentEventRepo.create({
        assignment: { id: assignment.id } as LeadAssignment,
        event_type: 'lifecycle_update',
        body: patch,
      }),
    );
    return assignment;
  }

  async listDuplicatePhoneGroups() {
    return this.leadRepo.manager.query<Array<{
      phone: string;
      count: string;
      leads: Array<{ id: string; title: string; status: string; created_at: string; is_duplicate: boolean }>;
    }>>(
      `SELECT LOWER(TRIM(metadata->>'phone')) AS phone,
              COUNT(*)::text AS count,
              json_agg(
                json_build_object(
                  'id', id,
                  'title', title,
                  'status', status,
                  'created_at', created_at,
                  'is_duplicate', (duplicate_of_lead_id IS NOT NULL)
                ) ORDER BY created_at ASC
              ) AS leads
       FROM leads
       WHERE COALESCE(metadata->>'phone', '') <> ''
         AND status != 'archived'
       GROUP BY 1
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC
       LIMIT 50`,
    );
  }

  async listResolvedDuplicateGroups(params: {
    limit: number;
    offset: number;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const conditions: string[] = [];
    const args: unknown[] = [];
    let idx = 1;

    if (params.dateFrom) {
      conditions.push(`d.updated_at >= $${idx++}`);
      args.push(new Date(params.dateFrom));
    }
    if (params.dateTo) {
      conditions.push(`d.updated_at <= $${idx++}`);
      args.push(new Date(params.dateTo));
    }
    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
    args.push(params.limit);
    args.push(params.offset);

    return this.leadRepo.manager.query<Array<{
      canonical_id: string;
      canonical_title: string;
      phone: string;
      duplicate_count: string;
      duplicates: Array<{ id: string; title: string; created_at: string }>;
    }>>(
      `SELECT c.id AS canonical_id,
              c.title AS canonical_title,
              LOWER(TRIM(c.metadata->>'phone')) AS phone,
              COUNT(d.id)::text AS duplicate_count,
              json_agg(
                json_build_object(
                  'id', d.id,
                  'title', d.title,
                  'created_at', d.created_at
                ) ORDER BY d.created_at ASC
              ) AS duplicates
       FROM leads d
       JOIN leads c ON d.duplicate_of_lead_id = c.id
       WHERE 1=1 ${whereClause}
       GROUP BY c.id, c.title, c.metadata->>'phone'
       ORDER BY COUNT(d.id) DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      args,
    );
  }

  async markLeadAsDuplicateOf(canonicalLeadId: string, duplicateLeadId: string) {
    if (canonicalLeadId === duplicateLeadId) {
      throw new BadRequestException('Cannot mark a lead as duplicate of itself');
    }
    const canonical = await this.findLeadOrThrow(canonicalLeadId);
    const dup = await this.findLeadOrThrow(duplicateLeadId);
    dup.duplicate_of_lead = canonical;
    dup.status = LeadStatus.ARCHIVED;
    await this.leadRepo.save(dup);
    return dup;
  }

  async buyLead(
    buyerId: string,
    leadId: string,
    purchaseType: PurchaseType = PurchaseType.MANUAL,
    exclusivityChoice: ExclusivityChoice = 'non_exclusive',
  ) {
    // ── Pre-transaction checks (no locking needed here) ──────────────────────
    const canBuy = await this.proEntitlementService.canBuyDuringEarlyAccess(
      buyerId,
      await this.findLeadOrThrow(leadId),
    );
    if (!canBuy) {
      throw new ForbiddenException(
        'This lead is in early access — available to Pro subscribers only for now.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      /*
      Lock the lead row only — no LEFT JOIN here. Postgres rejects
      `FOR UPDATE` when the query outer-joins nullable relations (reserved_by_user).
      */
      const lead = await queryRunner.manager
        .getRepository(Lead)
        .createQueryBuilder('lead')
        .setLock('pessimistic_write')
        .where('lead.id = :id', { id: leadId })
        .getOne();

      if (!lead) throw new NotFoundException('Lead not found');

      const now = new Date();

      // ── Status gating ───────────────────────────────────────────────────────
      if (lead.status === LeadStatus.AVAILABLE) {
        /* direct purchase — allowed */
      } else if (lead.status === LeadStatus.RESERVED) {
        const rows = await queryRunner.manager.query<
          Array<{ reserved_by_user_id: string | null }>
        >(`SELECT reserved_by_user_id FROM leads WHERE id = $1`, [leadId]);
        const reserverId = rows[0]?.reserved_by_user_id ?? null;
        if (!reserverId || reserverId !== buyerId) {
          throw new BadRequestException('Lead is reserved by another buyer');
        }
        if (!lead.reserved_until || lead.reserved_until < now) {
          throw new BadRequestException('Reservation expired');
        }
      } else {
        throw new BadRequestException('Lead is not available');
      }

      // ── Dual-price exclusivity lifecycle ─────────────────────────────────
      const rawExclusivePrice = this.getExclusivePriceCents(lead);
      const rawSharedPrice = this.getSharedPriceCents(lead);

      if (exclusivityChoice === 'exclusive') {
        if (lead.non_exclusive_buyers_count > 0) {
          throw new BadRequestException(
            'This lead already has non-exclusive buyers — exclusive purchase is no longer available.',
          );
        }
        // Check no existing exclusive assignment (exclude refunded)
        const existingExclusive = await queryRunner.manager
          .getRepository(LeadAssignment)
          .createQueryBuilder('a')
          .where('a.lead_id = :leadId', { leadId })
          .andWhere("a.exclusivity_choice = 'exclusive'")
          .andWhere("COALESCE(a.disposition, '') != 'refunded'")
          .getCount();
        if (existingExclusive > 0) {
          throw new BadRequestException('Lead has already been purchased exclusively.');
        }
      } else {
        // non_exclusive
        const existingExclusive = await queryRunner.manager
          .getRepository(LeadAssignment)
          .createQueryBuilder('a')
          .where('a.lead_id = :leadId', { leadId })
          .andWhere("a.exclusivity_choice = 'exclusive'")
          .andWhere("COALESCE(a.disposition, '') != 'refunded'")
          .getCount();
        if (existingExclusive > 0) {
          throw new BadRequestException(
            'This lead was purchased exclusively by another buyer.',
          );
        }
        if (lead.non_exclusive_buyers_count >= lead.max_non_exclusive_buyers) {
          throw new BadRequestException(
            'This lead has reached its maximum number of shared buyers.',
          );
        }
        // Prevent the same buyer from buying the same lead twice as non-exclusive (exclude refunded)
        const alreadyBought = await queryRunner.manager
          .getRepository(LeadAssignment)
          .createQueryBuilder('a')
          .where('a.lead_id = :leadId', { leadId })
          .andWhere('a.buyer_id = :buyerId', { buyerId })
          .andWhere("COALESCE(a.disposition, '') != 'refunded'")
          .getCount();
        if (alreadyBought > 0) {
          throw new BadRequestException(
            'You have already purchased this lead.',
          );
        }
      }

      // ── Duplicate guard ──────────────────────────────────────────────────
      const duplicateForBuyer = await this.detectCanonicalDuplicate(
        lead.metadata ?? {},
        lead.id,
      );
      if (duplicateForBuyer) {
        const priorAssignmentCount = await queryRunner.manager
          .getRepository(LeadAssignment)
          .createQueryBuilder('assignment')
          .innerJoin('assignment.lead', 'priorLead')
          .where('assignment.buyer_id = :buyerId', { buyerId })
          .andWhere('priorLead.id = :priorLeadId', { priorLeadId: duplicateForBuyer.id })
          .getCount();
        if (priorAssignmentCount > 0) {
          throw new BadRequestException(
            'This lead matches a lead already assigned to your account',
          );
        }
      }

      // ── Effective price after Pro discount ───────────────────────────────
      const rawPrice =
        exclusivityChoice === 'exclusive' ? rawExclusivePrice : rawSharedPrice;
      const effectivePriceCents =
        await this.proEntitlementService.discountedPriceCents(buyerId, rawPrice);

      const buyerWallet = await queryRunner.manager.findOne(WalletAccount, {
        where: { user: { id: buyerId } },
      });
      if (!buyerWallet) throw new NotFoundException('Wallet not found');

      const buyerBalanceCents = BigInt(buyerWallet.balance_cents);
      if (buyerBalanceCents < effectivePriceCents) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const activeLikeStatuses = [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.PAST_DUE,
        SubscriptionStatus.PAUSED,
      ];
      let cappedSub: Subscription | null = await queryRunner.manager
        .getRepository(Subscription)
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.user_id = :buyerId', { buyerId })
        .andWhere('s.status IN (:...sts)', { sts: activeLikeStatuses })
        .andWhere('s.monthly_lead_limit IS NOT NULL')
        .orderBy('s.updated_at', 'DESC')
        .getOne();

      if (cappedSub) {
        const cap = cappedSub.monthly_lead_limit!;
        if (cappedSub.leads_used_this_period >= cap) {
          throw new BadRequestException(
            'You have reached your subscription monthly lead limit for this billing period.',
          );
        }
      }

      // ── Update lead counters & status ───────────────────────────────────
      if (exclusivityChoice === 'exclusive') {
        lead.status = LeadStatus.SOLD;
      } else {
        lead.non_exclusive_buyers_count += 1;
        if (lead.non_exclusive_buyers_count >= lead.max_non_exclusive_buyers) {
          lead.status = LeadStatus.SOLD;
        }
      }
      lead.reserved_until = null;
      lead.reserved_by_user = null;
      await queryRunner.manager.save(lead);

      // ── Create assignment ────────────────────────────────────────────────
      const assignment = queryRunner.manager.create(LeadAssignment, {
        buyer: { id: buyerId } as any,
        lead,
        purchase_type: purchaseType,
        amount_charged_cents: effectivePriceCents.toString(),
        lifecycle_phase: 'new',
        exclusivity_choice: exclusivityChoice,
      });

      const savedAssignment = await queryRunner.manager.save(assignment);

      const effectivePriceNumber = Number(effectivePriceCents);
      if (!Number.isSafeInteger(effectivePriceNumber)) {
        throw new BadRequestException('Lead price is too large');
      }

      await this.walletService.debitWallet(
        buyerId,
        effectivePriceNumber,
        'lead_purchase',
        lead.id,
        exclusivityChoice === 'exclusive'
          ? 'Lead purchase (exclusive)'
          : 'Lead purchase (shared)',
      );

      if (cappedSub) {
        cappedSub.leads_used_this_period += 1;
        await queryRunner.manager.save(Subscription, cappedSub);
      }

      await queryRunner.commitTransaction();

      await Promise.allSettled([
        this.notificationsService.logPurchase(
          buyerId,
          lead.title,
          savedAssignment.amount_charged_cents,
          lead.id,
          purchaseType,
        ),
        this.integrationsService.emitCustomWebhookEvent(
          buyerId,
          purchaseType === PurchaseType.AUTO_BUY ? 'lead_auto_purchased' : 'lead_purchased',
          {
            assignment_id: savedAssignment.id,
            lead_id: lead.id,
            lead_title: lead.title,
            purchase_type: purchaseType,
            exclusivity_choice: exclusivityChoice,
            amount_charged_cents: savedAssignment.amount_charged_cents,
            market: lead.market,
            lead_type: lead.lead_type,
            metadata: lead.metadata ?? {},
          },
        ),
      ]);

      await this.assignmentEventRepo.save(
        this.assignmentEventRepo.create({
          assignment: { id: savedAssignment.id } as LeadAssignment,
          event_type: 'purchased',
          body: { purchase_type: purchaseType, exclusivity_choice: exclusivityChoice },
        }),
      );

      return savedAssignment;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
