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
    private readonly dataSource: DataSource,
    private readonly walletService: WalletService,
    private readonly distributionService: DistributionService,
    private readonly leadPricingService: LeadPricingService,
    private readonly notificationsService: NotificationsService,
    private readonly integrationsService: IntegrationsService,
    private readonly config: ConfigService,
  ) {}

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
    const lead = this.leadRepo.create({
      ...rest,
      external_id: dto.external_id ?? null,
      metadata: dto.metadata ?? {},
      utm: utm ?? {},
      canonical_lead_source: canonical_lead_source ?? null,
      duplicate_of_lead: duplicateOf,
      price_cents: dto.price_cents.toString(),
    });

    const savedLead = await this.leadRepo.save(lead);
    await this.leadPricingService.applyTierToLead(savedLead);
    await this.notificationsService.notifyMarketAlertsForLead({
      id: savedLead.id,
      title: savedLead.title,
      market: savedLead.market,
      lead_type: savedLead.lead_type,
      exclusivity_level: savedLead.exclusivity_level,
      price_cents: savedLead.price_cents,
    });
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

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      pagination: {
        page,
        limit,
        total,
      },
    };
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

    if (query.marketplaceTier) {
      qb.andWhere('lead.marketplace_tier = :tier', {
        tier: query.marketplaceTier,
      });
    }

    if (query.market) {
      qb.andWhere('lead.market = :market', { market: query.market });
    }

    if (query.type) {
      qb.andWhere('lead.lead_type = :leadType', { leadType: query.type });
    }

    const metadataFilters: Array<[string, string | undefined]> = [
      ['city', query.city],
      ['state', query.state],
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

    if (query.lead_mode === 'exclusive') {
      qb.andWhere('lead.exclusivity_level = :excl', {
        excl: ExclusivityLevel.EXCLUSIVE,
      });
    } else if (query.lead_mode === 'premium') {
      qb.andWhere('lead.exclusivity_level != :excl', {
        excl: ExclusivityLevel.EXCLUSIVE,
      });
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
      .getRawOne<{ sum: string }>();

    const totalRevenueRaw = await this.leadAssignmentRepo
      .createQueryBuilder('assignment')
      .select('COALESCE(SUM(assignment.amount_charged_cents), 0)', 'sum')
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
    const buyersRaw = await this.leadAssignmentRepo
      .createQueryBuilder('a')
      .select('COUNT(DISTINCT a.buyer_id)', 'c')
      .getRawOne<{ c: string }>();
    const assignmentCount = await this.leadAssignmentRepo.count();
    return {
      ...base,
      activeSubscriptions,
      distinctBuyers: Number(buyersRaw?.c ?? 0),
      totalAssignments: assignmentCount,
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
        .where('assignment.buyer_id = :userId', { userId });

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
    return this.leadRepo.query<
      Array<{ phone: string; ids: string[]; count: string }>
    >(
      `
      SELECT LOWER(TRIM(metadata->>'phone')) AS phone,
             array_agg(id::text ORDER BY created_at) AS ids,
             COUNT(*)::text AS count
      FROM leads
      WHERE COALESCE(metadata->>'phone','') <> ''
      GROUP BY 1
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `,
    );
  }

  async markLeadAsDuplicateOf(canonicalLeadId: string, duplicateLeadId: string) {
    if (canonicalLeadId === duplicateLeadId) {
      throw new BadRequestException('Cannot mark a lead as duplicate of itself');
    }
    const canonical = await this.findLeadOrThrow(canonicalLeadId);
    const dup = await this.findLeadOrThrow(duplicateLeadId);
    dup.duplicate_of_lead = canonical;
    await this.leadRepo.save(dup);
    return dup;
  }

  async buyLead(
    buyerId: string,
    leadId: string,
    purchaseType: PurchaseType = PurchaseType.MANUAL,
  ) {
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
      if (lead.status === LeadStatus.AVAILABLE) {
        /* direct purchase */
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

      const buyerWallet = await queryRunner.manager.findOne(WalletAccount, {
        where: { user: { id: buyerId } },
      });

      if (!buyerWallet) throw new NotFoundException('Wallet not found');

      const currentPriceCents = BigInt(lead.price_cents);
      const buyerBalanceCents = BigInt(buyerWallet.balance_cents);

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

      if (buyerBalanceCents < currentPriceCents) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      lead.status = LeadStatus.SOLD;
      lead.reserved_until = null;
      lead.reserved_by_user = null;
      await queryRunner.manager.save(lead);

      const assignment = queryRunner.manager.create(LeadAssignment, {
        buyer: { id: buyerId } as any,
        lead,
        purchase_type: purchaseType,
        amount_charged_cents: currentPriceCents.toString(),
        lifecycle_phase: 'new',
      });

      const savedAssignment = await queryRunner.manager.save(assignment);

      const currentPriceAsNumber = Number(currentPriceCents);
      if (!Number.isSafeInteger(currentPriceAsNumber)) {
        throw new BadRequestException('Lead price is too large');
      }

      await this.walletService.debitWallet(
        buyerId,
        currentPriceAsNumber,
        'lead_purchase',
        lead.id,
        'Lead purchase',
      );

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
          body: { purchase_type: purchaseType },
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
