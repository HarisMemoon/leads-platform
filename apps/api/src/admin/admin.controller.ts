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
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { WalletService } from '../wallet/wallet.service';
import { AuditLogService } from './audit-log.service';
import { AdminCreditWalletDto } from './dto/admin-credit-wallet.dto';
import { UpdateDistributionEngineSettingsDto } from './dto/update-distribution-engine-settings.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DistributionEngineSettings } from '../entities/distribution-engine-settings.entity';
import { User } from '../entities/user.entity';
import { ResourcesContent } from '../entities/resources-content.entity';
import { Lead } from '../entities/lead.entity';
import { VendorIntegration } from '../entities/vendor-integration.entity';
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
import { OutboundPingService } from '../outbound/outbound-ping.service';
import { CreateOutboundBuyerDto, PatchOutboundBuyerDto } from '../outbound/dto/outbound-buyer.dto';

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
    return { users, total };
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
