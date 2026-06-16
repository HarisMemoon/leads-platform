import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { WalletService } from '../wallet/wallet.service';
import { AuditLogService } from './audit-log.service';
import { AdminCreditWalletDto } from './dto/admin-credit-wallet.dto';
import { UpdateDistributionEngineSettingsDto } from './dto/update-distribution-engine-settings.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { DistributionEngineSettings } from '../entities/distribution-engine-settings.entity';
import { User } from '../entities/user.entity';
import { ResourcesContent } from '../entities/resources-content.entity';
import { Lead } from '../entities/lead.entity';
import { VendorIntegration } from '../entities/vendor-integration.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { Request } from 'express';
import { AdminDistributionLockDto } from './dto/admin-distribution-lock.dto';
import {
  CreateResourceContentDto,
  PatchResourceContentDto,
} from './dto/admin-resource-content.dto';
import { GhlOutboundService } from '../integrations/ghl-outbound.service';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminIngestionService } from './admin-ingestion.service';
import { AdminGradingService } from './admin-grading.service';
import { AdminIntegrationsHealthService } from './admin-integrations-health.service';
import { AdminPlansService } from './admin-plans.service';
import { CreateIngestionBatchDto } from './dto/admin-ingestion.dto';
import { GradingOverrideDto } from './dto/admin-grading.dto';
import { PatchPlanDto } from './dto/admin-plan.dto';
import { PlanType } from '../../common/enums/plan-type.enum';
import { LeadsService } from '../leads/leads.service';
import { RefundRequestsService } from '../leads/refund-requests.service';
import { OutboundPingService } from '../outbound/outbound-ping.service';
import { CreateOutboundBuyerDto, PatchOutboundBuyerDto } from '../outbound/dto/outbound-buyer.dto';
import { LeadPricingConfig } from '../entities/lead-pricing-config.entity';
import { LeadPricingService } from '../lead-pricing/lead-pricing.service';

const ENGINE_SETTINGS_ID = '00000000-0000-4000-8000-000000000001';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly walletService: WalletService,
    private readonly auditLogService: AuditLogService,
    private readonly ghlOutbound: GhlOutboundService,
    private readonly metricsService: AdminMetricsService,
    private readonly ingestionService: AdminIngestionService,
    private readonly gradingService: AdminGradingService,
    private readonly integrationsHealthService: AdminIntegrationsHealthService,
    private readonly plansService: AdminPlansService,
    private readonly leadsService: LeadsService,
    private readonly outboundPingService: OutboundPingService,
    private readonly refundRequestsService: RefundRequestsService,
    @InjectRepository(DistributionEngineSettings)
    private readonly engineSettingsRepo: Repository<DistributionEngineSettings>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ResourcesContent)
    private readonly resourcesRepo: Repository<ResourcesContent>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(VendorIntegration)
    private readonly vendorRepo: Repository<VendorIntegration>,
    @InjectRepository(LeadPricingConfig)
    private readonly leadPricingRepo: Repository<LeadPricingConfig>,
    @InjectRepository(LeadAssignment)
    private readonly assignmentRepo: Repository<LeadAssignment>,
    @InjectRepository(DistributionRule)
    private readonly distributionRuleRepo: Repository<DistributionRule>,
    private readonly leadPricingService: LeadPricingService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Get('metrics/breakdown')
  getMetricsBreakdown() {
    return this.metricsService.getBreakdown();
  }

  @Get('users/lookup')
  async lookupUserByEmail(@Query('email') email: string) {
    if (!email?.trim()) throw new NotFoundException('email query param required');
    const user = await this.userRepo.findOne({
      where: { email: email.trim().toLowerCase() },
      select: ['id', 'email', 'full_name', 'created_at'] as any,
    });
    if (!user) throw new NotFoundException(`No account found for ${email}`);
    return user;
  }

  @Get('users')
  async listUsers(
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const limit = Math.min(parseInt(limitStr ?? '10', 10) || 10, 100);
    const offset = parseInt(offsetStr ?? '0', 10) || 0;
    const qb = this.userRepo
      .createQueryBuilder('u')
      .select([
        'u.id', 'u.email', 'u.full_name', 'u.company_name', 'u.phone',
        'u.role', 'u.is_active', 'u.distribution_locked',
        'u.email_verified', 'u.onboarding_completed', 'u.created_at',
      ])
      .orderBy('u.created_at', 'DESC');
    if (dateFrom) qb.andWhere('u.created_at >= :dateFrom', { dateFrom: new Date(dateFrom) });
    if (dateTo) qb.andWhere('u.created_at <= :dateTo', { dateTo: new Date(dateTo) });
    const [users, total] = await qb.skip(offset).take(limit).getManyAndCount();

    // Compute account_status for each user by joining subscription, wallet, distribution rule
    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) return { users: [], total };

    const statusRows = await this.dataSource.query<Array<{
      user_id: string;
      sub_status: string | null;
      sub_period_end: string | null;
      wallet_cents: string | null;
      participation: boolean | null;
      is_active_rule: boolean | null;
      terms_accepted: boolean | null;
      launched_at: string | null;
      leads_used: string | null;
      monthly_lead_limit: string | null;
      has_crm: boolean | null;
      refund_rate_pct: string | null;
    }>>(`
      SELECT
        u.id AS user_id,
        s.status AS sub_status,
        s.current_period_end AS sub_period_end,
        w.balance_cents AS wallet_cents,
        dr.participation_enabled AS participation,
        dr.is_active AS is_active_rule,
        dr.launched_at AS launched_at,
        sub2.leads_used_this_period AS leads_used,
        sub2.monthly_lead_limit AS monthly_lead_limit,
        (EXISTS (
          SELECT 1 FROM terms_acceptances ta
          WHERE ta.user_id = u.id AND ta.terms_version = $2
        )) AS terms_accepted,
        (EXISTS (
          SELECT 1 FROM integrations i
          WHERE i.user_id = u.id
            AND i.config->>'webhookUrl' IS NOT NULL
            AND i.config->>'webhookUrl' <> ''
        )) AS has_crm,
        (
          SELECT CASE WHEN COUNT(la.id) > 0
            THEN ROUND((COUNT(rr.id)::numeric / COUNT(la.id)::numeric) * 100)
            ELSE 0 END
          FROM lead_assignments la
          LEFT JOIN lead_refund_requests rr ON rr.lead_assignment_id = la.id
          WHERE la.buyer_id = u.id
        ) AS refund_rate_pct
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.plan_type = 'pro'
        AND s.status IN ('active','past_due','cancelled')
      LEFT JOIN subscriptions sub2 ON sub2.user_id = u.id AND sub2.plan_type = 'pro'
        AND sub2.status IN ('active','past_due')
      LEFT JOIN wallet_accounts w ON w.user_id = u.id
      LEFT JOIN distribution_rules dr ON dr.user_id = u.id
      WHERE u.id = ANY($1)
    `, [userIds, this.config.get<string>('TERMS_VERSION') ?? '2025-01']);

    const statusMap = new Map(statusRows.map((r) => [r.user_id, r]));

    const usersWithStatus = users.map((u) => {
      const s = statusMap.get(u.id);
      let account_status = 'active';
      if (!u.is_active) account_status = 'inactive';
      else if (!s?.sub_status || (s.sub_status === 'cancelled' && (!s.sub_period_end || new Date(s.sub_period_end) <= new Date()))) account_status = 'subscription_canceled';
      else if (s.sub_status === 'past_due') account_status = 'subscription_past_due';
      else if (!s?.terms_accepted) account_status = 'terms_not_accepted';
      else if (Number(s?.refund_rate_pct ?? 0) >= 25) account_status = 'refund_abuse_review';
      else if (!s?.launched_at) account_status = 'setup_incomplete';
      else if (s?.monthly_lead_limit != null && Number(s.leads_used ?? 0) >= Number(s.monthly_lead_limit)) account_status = 'lead_cap_reached';
      else if (!s?.has_crm) account_status = 'crm_disconnected';
      else if (!s?.participation) account_status = 'auto_delivery_off';
      else if (!s?.is_active_rule) account_status = 'distribution_paused';
      else {
        const bal = Number(s?.wallet_cents ?? '0');
        if (bal < 2500) account_status = 'wallet_empty';
        else if (bal < 5000) account_status = 'wallet_low';
      }
      return { ...u, account_status };
    });

    return { users: usersWithStatus, total };
  }

  @Patch('users/:userId/active')
  async setUserActive(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body('is_active') isActive: boolean,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.is_active = isActive;
    await this.userRepo.save(user);
    return { id: user.id, email: user.email, is_active: user.is_active };
  }

  @Get('metrics/intake')
  getIntakeStats(
    @Query('period') period: 'today' | 'week' | 'month' = 'today',
  ) {
    const valid = ['today', 'week', 'month'];
    return this.metricsService.getIntakePeriodStats(
      valid.includes(period) ? period : 'today',
    );
  }

  @Delete('leads/:id')
  @HttpCode(HttpStatus.OK)
  deleteAdminLead(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.leadsService.deleteLead(id);
  }

  // ── Pending leads (inbound review queue) ──────────────────────────────────

  @Get('leads/pending')
  async getPendingLeads() {
    const leads = await this.leadRepo.find({
      where: { status: LeadStatus.NEW, source: 'inbound' },
      order: { created_at: 'DESC' },
      take: 200,
    });

    if (leads.length === 0) return { groups: [], total: 0 };

    // collect unique vendor IDs
    const vendorIds = [...new Set(
      leads.map((l) => l.canonical_lead_source).filter(Boolean) as string[],
    )];

    const vendors = vendorIds.length
      ? await this.vendorRepo.findBy({ id: In(vendorIds) })
      : [];

    const vendorMap = new Map(vendors.map((v) => [v.id, v]));

    // group by vendor (null = unknown)
    const byVendor = new Map<string | null, typeof leads>();
    for (const lead of leads) {
      const key = lead.canonical_lead_source ?? null;
      if (!byVendor.has(key)) byVendor.set(key, []);
      byVendor.get(key)!.push(lead);
    }

    const groups = [...byVendor.entries()].map(([vendorId, vendorLeads]) => ({
      vendor_id: vendorId,
      vendor_name: vendorId ? (vendorMap.get(vendorId)?.name ?? 'Unknown vendor') : 'Direct / unknown',
      count: vendorLeads.length,
      leads: vendorLeads.map((l) => ({
        id: l.id,
        title: l.title,
        market: l.market,
        lead_type: l.lead_type,
        price_cents: l.price_cents,
        metadata: l.metadata,
        created_at: l.created_at,
      })),
    }));

    return { groups, total: leads.length };
  }

  @Patch('leads/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveLead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    lead.status = LeadStatus.AVAILABLE;
    const saved = await this.leadRepo.save(lead);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_lead_approve',
      targetType: 'lead',
      targetId: id,
      metadata: {},
      ipAddress: ip,
    });
    void this.outboundPingService.pingAll(saved).catch(() => {/* logged internally */});
    return { ok: true, id: saved.id, status: saved.status };
  }

  @Patch('leads/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectLead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    lead.status = LeadStatus.ARCHIVED;
    await this.leadRepo.save(lead);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_lead_reject',
      targetType: 'lead',
      targetId: id,
      metadata: {},
      ipAddress: ip,
    });
    return { ok: true, id, status: LeadStatus.ARCHIVED };
  }

  @Patch('leads/:id/internal-cost')
  @HttpCode(HttpStatus.OK)
  async patchLeadInternalCost(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: {
      internal_cost_cents?: number | null;
      ping_post_cost_cents?: number | null;
      campaign_name?: string | null;
      ad_source?: string | null;
      cost_notes?: string | null;
    },
  ) {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (body.internal_cost_cents !== undefined)
      lead.internal_cost_cents = body.internal_cost_cents != null ? String(body.internal_cost_cents) : null;
    if (body.campaign_name !== undefined) lead.campaign_name = body.campaign_name ?? null;
    if (body.ad_source !== undefined) lead.ad_source = body.ad_source ?? null;
    if (body.cost_notes !== undefined) lead.cost_notes = body.cost_notes ?? null;
    if (body.ping_post_cost_cents !== undefined)
      lead.ping_post_cost_cents = body.ping_post_cost_cents != null ? String(body.ping_post_cost_cents) : null;
    const saved = await this.leadRepo.save(lead);
    return {
      id: saved.id,
      internal_cost_cents: saved.internal_cost_cents,
      ping_post_cost_cents: saved.ping_post_cost_cents,
      campaign_name: saved.campaign_name,
      ad_source: saved.ad_source,
      cost_notes: saved.cost_notes,
    };
  }

  @Post('leads/bulk-approve')
  @HttpCode(HttpStatus.OK)
  async bulkApproveLeads(
    @Body('ids') ids: string[],
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    if (!Array.isArray(ids) || ids.length === 0) return { ok: true, approved: 0 };
    const leads = await this.leadRepo.findBy({ id: In(ids), status: LeadStatus.NEW });
    for (const lead of leads) {
      lead.status = LeadStatus.AVAILABLE;
    }
    const saved = await this.leadRepo.save(leads);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_leads_bulk_approve',
      targetType: 'lead',
      targetId: ids.join(','),
      metadata: { count: saved.length },
      ipAddress: ip,
    });
    for (const lead of saved) {
      void this.outboundPingService.pingAll(lead).catch(() => {/* logged internally */});
    }
    return { ok: true, approved: saved.length };
  }

  @Post('leads/bulk-reject')
  @HttpCode(HttpStatus.OK)
  async bulkRejectLeads(
    @Body('ids') ids: string[],
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    if (!Array.isArray(ids) || ids.length === 0) return { ok: true, rejected: 0 };
    const leads = await this.leadRepo.findBy({ id: In(ids), status: LeadStatus.NEW });
    for (const lead of leads) {
      lead.status = LeadStatus.ARCHIVED;
    }
    await this.leadRepo.save(leads);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_leads_bulk_reject',
      targetType: 'lead',
      targetId: ids.join(','),
      metadata: { count: leads.length },
      ipAddress: ip,
    });
    return { ok: true, rejected: leads.length };
  }

  @Get('ingestion/batches')
  listIngestionBatches(
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.ingestionService.listBatches(limit);
  }

  @Get('ingestion/stats')
  getIngestionStats() {
    return this.ingestionService.getStats();
  }

  @Post('ingestion/batches')
  async createIngestionBatch(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: CreateIngestionBatchDto,
    @Ip() ip: string,
  ) {
    const result = await this.ingestionService.createBatch(req.user.userId, dto);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_ingestion_batch_create',
      targetType: 'lead_ingestion_batch',
      targetId: result.id,
      metadata: {
        filename: dto.filename,
        vendor: dto.vendor ?? null,
        total_rows: dto.rows.length,
      },
      ipAddress: ip,
    });
    return result;
  }

  @Get('grading/queue')
  getGradingQueue(
    @Query('bucket') bucket: 'high' | 'borderline' | 'below' | undefined,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return this.gradingService.getQueue({ bucket, limit, page });
  }

  @Get('grading/stats')
  getGradingStats() {
    return this.gradingService.getStats();
  }

  @Get('grading/overrides')
  listGradingOverrides(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.gradingService.listOverrides(limit);
  }

  @Post('grading/overrides')
  async createGradingOverride(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: GradingOverrideDto,
    @Ip() ip: string,
  ) {
    const result = await this.gradingService.createOverride(
      req.user.userId,
      dto.lead_id,
      dto.override_score,
      dto.notes,
    );
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_grading_override',
      targetType: 'lead',
      targetId: dto.lead_id,
      metadata: {
        original_score: result.original_score,
        override_score: result.override_score,
        notes: dto.notes ?? null,
      },
      ipAddress: ip,
    });
    return result;
  }

  @Get('integrations/health')
  getIntegrationsHealth() {
    return this.integrationsHealthService.getHealth();
  }

  // ── Lead pricing config ─────────────────────────────────────────────────────

  @Get('lead-pricing')
  getLeadPricing() {
    return this.leadPricingRepo.find({ order: { lead_type: 'ASC' } });
  }

  @Patch('lead-pricing/:type')
  async patchLeadPricing(
    @Param('type') type: string,
    @Body() body: Partial<{
      new_lead_price_cents: number;
      shared_price_cents: number | null;
      discount_after_days: number;
      discount_amount_cents: number;
      min_price_floor_cents: number | null;
    }>,
  ) {
    const config = await this.leadPricingRepo.findOne({ where: { lead_type: type } });
    if (!config) {
      // Create if not exists (e.g. first run without migration seeding)
      const newConfig = this.leadPricingRepo.create();
      newConfig.lead_type = type;
      newConfig.new_lead_price_cents = String(body.new_lead_price_cents ?? 15000);
      newConfig.shared_price_cents = body.shared_price_cents != null ? String(body.shared_price_cents) : null;
      newConfig.discount_after_days = body.discount_after_days ?? 7;
      newConfig.discount_amount_cents = String(body.discount_amount_cents ?? 0);
      newConfig.min_price_floor_cents = body.min_price_floor_cents != null ? String(body.min_price_floor_cents) : null;
      return this.leadPricingRepo.save(newConfig);
    }
    if (body.new_lead_price_cents !== undefined) config.new_lead_price_cents = String(body.new_lead_price_cents);
    if (body.shared_price_cents !== undefined) config.shared_price_cents = body.shared_price_cents != null ? String(body.shared_price_cents) : null;
    if (body.discount_after_days !== undefined) config.discount_after_days = body.discount_after_days;
    if (body.discount_amount_cents !== undefined) config.discount_amount_cents = String(body.discount_amount_cents);
    if (body.min_price_floor_cents !== undefined) config.min_price_floor_cents = body.min_price_floor_cents != null ? String(body.min_price_floor_cents) : null;
    const saved = await this.leadPricingRepo.save(config);
    // Bust the in-memory cache so new leads immediately use the updated price
    this.leadPricingService.invalidate(type);
    return saved;
  }

  // ── Subscription plans ──────────────────────────────────────────────────────

  @Get('subscriptions/plans')
  listSubscriptionPlans() {
    return this.plansService.list();
  }

  @Patch('subscriptions/plans/:planType')
  async patchSubscriptionPlan(
    @Req() req: Request & { user: { userId: string } },
    @Param('planType', new ParseEnumPipe(PlanType)) planType: PlanType,
    @Body() dto: PatchPlanDto,
    @Ip() ip: string,
  ) {
    const updated = await this.plansService.patch(planType, dto);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_subscription_plan_patch',
      targetType: 'subscription_plan',
      targetId: planType,
      metadata: dto as Record<string, any>,
      ipAddress: ip,
    });
    return updated;
  }

  // ── Vendor performance stats ─────────────────────────────────────────────

  @Get('vendors/stats')
  async getVendorStats(@Query('sort') sort?: string) {
    const rows = await this.dataSource.query<Array<{
      id: string;
      name: string;
      enabled: boolean;
      created_at: string;
      total_hits: string;
      accepted_hits: string;
      total_leads: string;
      purchased_leads: string;
      total_revenue_cents: string;
    }>>(`
      SELECT
        v.id,
        v.name,
        v.enabled,
        v.created_at,
        COALESCE(hits.total_hits, 0)    AS total_hits,
        COALESCE(hits.accepted_hits, 0) AS accepted_hits,
        COALESCE(ld.total_leads, 0)     AS total_leads,
        COALESCE(ld.purchased_leads, 0) AS purchased_leads,
        COALESCE(ld.total_revenue_cents, 0) AS total_revenue_cents
      FROM vendor_integrations v

      LEFT JOIN (
        SELECT
          vendor_id,
          COUNT(*) AS total_hits,
          COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_hits
        FROM vendor_webhook_hits
        GROUP BY vendor_id
      ) hits ON hits.vendor_id = v.id

      LEFT JOIN (
        SELECT
          l.canonical_lead_source AS vendor_id,
          COUNT(DISTINCT l.id) AS total_leads,
          COUNT(DISTINCT la.lead_id) AS purchased_leads,
          COALESCE(SUM(la.amount_charged_cents::bigint), 0) AS total_revenue_cents
        FROM leads l
        LEFT JOIN lead_assignments la ON la.lead_id = l.id
        WHERE l.source = 'inbound' AND l.canonical_lead_source IS NOT NULL
        GROUP BY l.canonical_lead_source
      ) ld ON ld.vendor_id = v.id::text

      ORDER BY ${
        sort === 'leads'    ? 'ld.total_leads DESC NULLS LAST' :
        sort === 'sold'     ? 'ld.purchased_leads DESC NULLS LAST' :
        sort === 'revenue'  ? 'ld.total_revenue_cents DESC NULLS LAST' :
        sort === 'latest'   ? '(SELECT MAX(l2.created_at) FROM leads l2 WHERE l2.source = \'inbound\' AND l2.canonical_lead_source = v.id::text) DESC NULLS LAST' :
        'v.created_at DESC'
      }
    `);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      created_at: r.created_at,
      total_hits: Number(r.total_hits),
      accepted_hits: Number(r.accepted_hits),
      total_leads: Number(r.total_leads),
      purchased_leads: Number(r.purchased_leads),
      total_revenue_cents: Number(r.total_revenue_cents),
      conversion_rate: Number(r.total_leads) > 0
        ? Math.round((Number(r.purchased_leads) / Number(r.total_leads)) * 100)
        : 0,
    }));
  }

  @Get('vendors/:id/stats')
  async getVendorDetail(@Param('id', ParseUUIDPipe) id: string) {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const [summary] = await this.dataSource.query<Array<{
      total_leads: string;
      purchased_leads: string;
      total_revenue_cents: string;
      avg_revenue_per_lead: string;
    }>>(`
      SELECT
        COUNT(DISTINCT l.id) AS total_leads,
        COUNT(DISTINCT la.lead_id) AS purchased_leads,
        COALESCE(SUM(la.amount_charged_cents::bigint), 0) AS total_revenue_cents,
        COALESCE(AVG(la.amount_charged_cents::bigint), 0) AS avg_revenue_per_lead
      FROM leads l
      LEFT JOIN lead_assignments la ON la.lead_id = l.id
      WHERE l.source = 'inbound' AND l.canonical_lead_source = $1
    `, [id]);

    const recentLeads = await this.dataSource.query<Array<{
      lead_id: string;
      title: string;
      market: string;
      created_at: string;
      purchase_count: string;
      revenue_cents: string;
    }>>(`
      SELECT
        l.id AS lead_id,
        l.title,
        l.market,
        l.created_at,
        COUNT(la.id) AS purchase_count,
        COALESCE(SUM(la.amount_charged_cents::bigint), 0) AS revenue_cents
      FROM leads l
      LEFT JOIN lead_assignments la ON la.lead_id = l.id
      WHERE l.source = 'inbound' AND l.canonical_lead_source = $1
      GROUP BY l.id, l.title, l.market, l.created_at
      ORDER BY l.created_at DESC
      LIMIT 20
    `, [id]);

    const hitStats = await this.dataSource.query<Array<{
      total: string; accepted: string; rejected: string;
    }>>(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
      FROM vendor_webhook_hits WHERE vendor_id = $1
    `, [id]);

    return {
      vendor,
      summary: {
        total_leads: Number(summary?.total_leads ?? 0),
        purchased_leads: Number(summary?.purchased_leads ?? 0),
        total_revenue_cents: Number(summary?.total_revenue_cents ?? 0),
        avg_revenue_per_lead: Math.round(Number(summary?.avg_revenue_per_lead ?? 0)),
        conversion_rate: Number(summary?.total_leads ?? 0) > 0
          ? Math.round((Number(summary?.purchased_leads ?? 0) / Number(summary?.total_leads ?? 0)) * 100)
          : 0,
      },
      webhook_hits: {
        total: Number(hitStats[0]?.total ?? 0),
        accepted: Number(hitStats[0]?.accepted ?? 0),
        rejected: Number(hitStats[0]?.rejected ?? 0),
      },
      recent_leads: recentLeads.map((l) => ({
        lead_id: l.lead_id,
        title: l.title,
        market: l.market,
        created_at: l.created_at,
        purchase_count: Number(l.purchase_count),
        revenue_cents: Number(l.revenue_cents),
      })),
    };
  }

  // ── Outbound buyer endpoints ────────────────────────────────────────────

  @Get('outbound/buyers')
  listOutboundBuyers() {
    return this.outboundPingService.listEndpoints();
  }

  @Post('outbound/buyers')
  createOutboundBuyer(@Body() dto: CreateOutboundBuyerDto) {
    return this.outboundPingService.createEndpoint(dto);
  }

  @Patch('outbound/buyers/:id')
  patchOutboundBuyer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PatchOutboundBuyerDto,
  ) {
    return this.outboundPingService.patchEndpoint(id, dto);
  }

  @Delete('outbound/buyers/:id')
  deleteOutboundBuyer(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.outboundPingService.deleteEndpoint(id);
  }

  @Post('outbound/buyers/:id/test-ping')
  testOutboundPing(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.outboundPingService.testPing(id);
  }

  @Get('outbound/logs')
  getOutboundLogs(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('lead_id') leadId?: string,
  ) {
    return this.outboundPingService.listLogs(limit, leadId);
  }

  @Post('leads/:id/ping-outbound')
  @HttpCode(HttpStatus.OK)
  async triggerOutboundPingForLead(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const lead = await this.leadsService.getLeadById(id);
    return this.outboundPingService.pingAll(lead);
  }

  @Post('leads/:id/assign')
  @HttpCode(HttpStatus.OK)
  async adminAssignLead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('user_id') userId: string,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    if (!userId) throw new NotFoundException('user_id is required');
    const assignment = await this.leadsService.assignLeadAsAdmin(id, userId);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_lead_assign',
      targetType: 'lead',
      targetId: id,
      metadata: { assigned_to: userId, assignment_id: assignment.id },
      ipAddress: ip,
    });
    return assignment;
  }

  @Delete('assignments/:id')
  @HttpCode(HttpStatus.OK)
  async adminRevokeAssignment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    const result = await this.leadsService.revokeAssignment(id);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_assignment_revoke',
      targetType: 'lead_assignment',
      targetId: id,
      metadata: { refunded_cents: result.refunded_cents },
      ipAddress: ip,
    });
    return result;
  }

  @Post('assignments/:id/replace')
  @HttpCode(HttpStatus.OK)
  async adminReplaceAssignment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('new_lead_id') newLeadId: string,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    if (!newLeadId) throw new NotFoundException('new_lead_id is required');
    const result = await this.leadsService.replaceAssignment(id, newLeadId);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_assignment_replace',
      targetType: 'lead_assignment',
      targetId: id,
      metadata: { new_lead_id: newLeadId, new_assignment_id: result.new_assignment?.id },
      ipAddress: ip,
    });
    return result;
  }

  @Patch('leads/:id/mark-bad')
  @HttpCode(HttpStatus.OK)
  async adminMarkLeadBad(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    const lead = await this.leadsService.markLeadBad(id);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_lead_mark_bad',
      targetType: 'lead',
      targetId: id,
      metadata: {},
      ipAddress: ip,
    });
    return { ok: true, id: lead.id, status: lead.status, is_bad_lead: lead.is_bad_lead };
  }

  @Post('wallet/credit')
  async creditWallet(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: AdminCreditWalletDto,
    @Ip() ip: string,
  ) {
    await this.walletService.adminCreditWallet(
      dto.user_id,
      dto.amount_cents,
      dto.description,
    );
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_wallet_credit',
      targetType: 'user',
      targetId: dto.user_id,
      metadata: {
        amount_cents: dto.amount_cents,
        description: dto.description,
      },
      ipAddress: ip,
    });
    void this.ghlOutbound.emit('admin_wallet_credit', {
      user_id: dto.user_id,
      amount_cents: dto.amount_cents,
      description: dto.description,
    });
    return { ok: true };
  }

  @Get('users/:userId/refund-abuse-stats')
  getRefundAbuseStats(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.refundRequestsService.getRefundAbuseStats(userId);
  }

  @Patch('users/:userId/distribution-lock')
  async setDistributionLock(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: AdminDistributionLockDto,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.distribution_locked = dto.locked;
    await this.userRepo.save(user);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_distribution_lock',
      targetType: 'user',
      targetId: userId,
      metadata: { locked: dto.locked },
      ipAddress: ip,
    });
    return { ok: true, distribution_locked: user.distribution_locked };
  }

  // ── Mark lead for manual review ─────────────────────────────────────────

  @Post('leads/:id/mark-review')
  @HttpCode(HttpStatus.OK)
  async markLeadForReview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('reason') reason: string | undefined,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    lead.status = LeadStatus.MANUAL_REVIEW;
    lead.metadata = { ...(lead.metadata ?? {}), review_reason: reason ?? 'admin_flagged', review_at: new Date().toISOString() };
    await this.leadRepo.save(lead);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_lead_mark_review',
      targetType: 'lead',
      targetId: id,
      metadata: { reason: reason ?? 'admin_flagged' },
      ipAddress: ip,
    });
    return { ok: true, id, status: LeadStatus.MANUAL_REVIEW };
  }

  // ── Admin delivery pause / resume ────────────────────────────────────────

  @Post('users/:userId/pause-delivery')
  @HttpCode(HttpStatus.OK)
  async pauseDelivery(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    await this.distributionRuleRepo.update({ user: { id: userId } }, { is_active: false });
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_pause_delivery',
      targetType: 'user',
      targetId: userId,
      metadata: {},
      ipAddress: ip,
    });
    return { ok: true, userId, delivery_paused: true };
  }

  @Post('users/:userId/resume-delivery')
  @HttpCode(HttpStatus.OK)
  async resumeDelivery(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    await this.distributionRuleRepo.update({ user: { id: userId } }, { is_active: true });
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_resume_delivery',
      targetType: 'user',
      targetId: userId,
      metadata: {},
      ipAddress: ip,
    });
    return { ok: true, userId, delivery_paused: false };
  }

  // ── Manual lead assign / remove ───────────────────────────────────────────

  @Post('leads/:leadId/assign')
  @HttpCode(HttpStatus.OK)
  async assignLeadToUser(
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Body('user_id') userId: string,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    const lead = await this.leadRepo.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Create assignment directly without charging wallet (admin override)
    const assignment = this.assignmentRepo.create({
      lead: { id: leadId } as Lead,
      buyer: { id: userId } as User,
      purchase_type: 'manual' as any,
      amount_charged_cents: '0',
      exclusivity_choice: 'non_exclusive',
    });
    const saved = await this.assignmentRepo.save(assignment);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_lead_assign',
      targetType: 'lead',
      targetId: leadId,
      metadata: { assigned_to: userId },
      ipAddress: ip,
    });
    return { ok: true, assignment_id: saved.id, lead_id: leadId, user_id: userId };
  }

  @Delete('assignments/:id')
  @HttpCode(HttpStatus.OK)
  async removeAssignment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id },
      relations: { lead: true, buyer: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.assignmentRepo.delete(id);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_remove_assignment',
      targetType: 'assignment',
      targetId: id,
      metadata: { lead_id: assignment.lead?.id, buyer_id: assignment.buyer?.id },
      ipAddress: ip,
    });
    return { ok: true, removed_assignment_id: id };
  }

  // ── Mark lead bad ─────────────────────────────────────────────────────────

  @Post('leads/:id/mark-bad')
  @HttpCode(HttpStatus.OK)
  async markLeadBad(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('reason') reason: string | undefined,
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    lead.status = LeadStatus.ARCHIVED;
    lead.metadata = { ...(lead.metadata ?? {}), bad_lead: true, bad_reason: reason ?? 'admin_marked_bad' };
    await this.leadRepo.save(lead);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_lead_mark_bad',
      targetType: 'lead',
      targetId: id,
      metadata: { reason: reason ?? 'admin_marked_bad' },
      ipAddress: ip,
    });
    return { ok: true, id, status: LeadStatus.ARCHIVED };
  }

  @Get('resources/items')
  listResourceItems() {
    return this.resourcesRepo.find({
      order: { sort_order: 'ASC', created_at: 'DESC' },
      take: 500,
    });
  }

  @Post('resources/items')
  createResourceItem(@Body() dto: CreateResourceContentDto) {
    const row = this.resourcesRepo.create({
      kind: dto.kind,
      title: dto.title,
      body: dto.body ?? null,
      url: dto.url ?? null,
      sort_order: dto.sort_order ?? 0,
      is_published: dto.is_published ?? true,
    });
    return this.resourcesRepo.save(row);
  }

  @Patch('resources/items/:id')
  async patchResourceItem(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PatchResourceContentDto,
  ) {
    const row = await this.resourcesRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Resource item not found');
    }
    if (dto.kind !== undefined) row.kind = dto.kind;
    if (dto.title !== undefined) row.title = dto.title;
    if (dto.body !== undefined) row.body = dto.body;
    if (dto.url !== undefined) row.url = dto.url;
    if (dto.sort_order !== undefined) row.sort_order = dto.sort_order;
    if (dto.is_published !== undefined) row.is_published = dto.is_published;
    return this.resourcesRepo.save(row);
  }

  @Delete('resources/items/:id')
  async deleteResourceItem(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.resourcesRepo.delete({ id });
    return { ok: true };
  }

  @Get('audit-logs')
  getAuditLogs() {
    return this.auditLogService.listRecent(200);
  }

  @Get('distribution-engine/settings')
  async getEngineSettings() {
    let row = await this.engineSettingsRepo.findOne({
      where: { id: ENGINE_SETTINGS_ID },
    });
    if (!row) {
      row = await this.engineSettingsRepo.save(
        this.engineSettingsRepo.create({
          id: ENGINE_SETTINGS_ID,
          queue_paused: false,
          max_auto_distribution_runs: 10,
          cooldown_minutes_between_runs: 15,
          markdown_after_days: 7,
          markdown_percent: 10,
        }),
      );
    }
    return row;
  }

  @Patch('distribution-engine/settings')
  async patchEngineSettings(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: UpdateDistributionEngineSettingsDto,
    @Ip() ip: string,
  ) {
    let row = await this.engineSettingsRepo.findOne({
      where: { id: ENGINE_SETTINGS_ID },
    });
    if (!row) {
      row = this.engineSettingsRepo.create({
        id: ENGINE_SETTINGS_ID,
        queue_paused: false,
        max_auto_distribution_runs: 10,
        cooldown_minutes_between_runs: 15,
        markdown_after_days: 7,
        markdown_percent: 10,
      });
    }
    if (dto.queue_paused !== undefined) row.queue_paused = dto.queue_paused;
    if (dto.max_auto_distribution_runs !== undefined) {
      row.max_auto_distribution_runs = dto.max_auto_distribution_runs;
    }
    if (dto.cooldown_minutes_between_runs !== undefined) {
      row.cooldown_minutes_between_runs = dto.cooldown_minutes_between_runs;
    }
    if (dto.markdown_after_days !== undefined) {
      row.markdown_after_days = dto.markdown_after_days;
    }
    if (dto.markdown_percent !== undefined) {
      row.markdown_percent = dto.markdown_percent;
    }
    if (dto.early_access_minutes !== undefined) {
      row.early_access_minutes = dto.early_access_minutes;
    }
    const saved = await this.engineSettingsRepo.save(row);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_distribution_engine_patch',
      targetType: 'distribution_engine_settings',
      targetId: ENGINE_SETTINGS_ID,
      metadata: dto as Record<string, any>,
      ipAddress: ip,
    });
    return saved;
  }
}
