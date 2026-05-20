import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { DistributionService } from './distribution.service';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { WalletAccount } from '../entities/wallet-account.entity';
import { DistributionEngineSettings } from '../entities/distribution-engine-settings.entity';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { PurchaseType } from '../../common/enums/purchase-type.enum';
import { LeadsService, ExclusivityChoice } from '../leads/leads.service';
import {
  ProEntitlementService,
  SUBSCRIPTION_PRICE_INBOUND_CENTS,
  SUBSCRIPTION_PRICE_OUTBOUND_CENTS,
} from '../subscriptions/pro-entitlement.service';

type ProcessLeadPayload = {
  leadId: string;
};

const ENGINE_SETTINGS_ID = '00000000-0000-4000-8000-000000000001';

@Injectable()
@Processor('lead-distribution')
export class LeadDistributionProcessor {
  private readonly logger = new Logger(LeadDistributionProcessor.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(DistributionRule)
    private readonly distributionRuleRepo: Repository<DistributionRule>,
    @InjectRepository(WalletAccount)
    private readonly walletRepo: Repository<WalletAccount>,
    @InjectRepository(LeadAssignment)
    private readonly leadAssignmentRepo: Repository<LeadAssignment>,
    @InjectRepository(DistributionEngineSettings)
    private readonly engineSettingsRepo: Repository<DistributionEngineSettings>,
    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,
    private readonly distributionService: DistributionService,
    private readonly proEntitlementService: ProEntitlementService,
  ) {}

  /**
   * Flat subscription pricing per spec:
   *   Inbound  → $30 | Outbound → $20
   * Falls back to stored shared_price_cents when explicitly set by admin.
   * Mirrors the formula in LeadsService so all three paths charge identically.
   */
  private canonicalSharedPrice(lead: Lead): bigint {
    const stored = lead.shared_price_cents != null ? BigInt(lead.shared_price_cents) : 0n;
    if (stored > 0n) return stored;
    return lead.lead_type === 'outbound'
      ? SUBSCRIPTION_PRICE_OUTBOUND_CENTS
      : SUBSCRIPTION_PRICE_INBOUND_CENTS;
  }

  @Process('processLead')
  async processLead(job: Job<ProcessLeadPayload>) {
    let settings = await this.engineSettingsRepo.findOne({
      where: { id: ENGINE_SETTINGS_ID },
    });
    if (!settings) {
      settings = await this.engineSettingsRepo.save(
        this.engineSettingsRepo.create({
          id: ENGINE_SETTINGS_ID,
          queue_paused: false,
          max_auto_distribution_runs: 10,
          cooldown_minutes_between_runs: 15,
          markdown_after_days: 7,
          markdown_percent: 10,
          early_access_minutes: 60,
        }),
      );
    }
    if (settings.queue_paused) {
      return;
    }

    const lead = await this.leadRepo.findOne({ where: { id: job.data.leadId } });
    if (!lead || lead.status !== LeadStatus.AVAILABLE) {
      return;
    }

    // ── Eligible rules: participation on + active ──────────────────────────
    const rules = await this.distributionRuleRepo.find({
      where: {
        participation_enabled: true,
        is_active: true,
      },
      relations: { user: true },
    });

    if (rules.length === 0) {
      await this.scheduleRetryIfNeeded(lead.id, settings);
      return;
    }

    const now = new Date();
    const isEarlyAccess =
      lead.early_access_until != null && new Date(lead.early_access_until) > now;

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    const dow = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dow);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    /*
     * ── Priority-ordered merry-go-round ─────────────────────────────────────
     * Step 1: Exclusive-preference rules are tried first (spec: exclusive
     *         buyers always get priority over shared/subscription buyers).
     * Step 2: Non-exclusive (shared) rules run only if no exclusive sale
     *         happened — and only for active Pro subscribers.
     *
     * Within each group, sort by rotation_position ASC (lowest goes next),
     * tiebreak by created_at ASC. After a successful assignment the buyer
     * is moved to the back of the rotation queue (merry-go-round).
     */
    const rotationSort = (a: DistributionRule, b: DistributionRule) => {
      const posDiff = (a.rotation_position ?? 0) - (b.rotation_position ?? 0);
      if (posDiff !== 0) return posDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    };

    const exclusiveRules = [...rules]
      .filter((r) => (r.exclusivity_preference ?? 'both') === 'exclusive_only')
      .sort(rotationSort);

    const sharedRules = [...rules]
      .filter((r) => (r.exclusivity_preference ?? 'both') !== 'exclusive_only')
      .sort(rotationSort);

    const tryRule = async (
      rule: DistributionRule,
      exclusivityChoice: ExclusivityChoice,
    ): Promise<boolean> => {
      const userId = rule.user.id;

      // ── Early-access gate: during window, only Pro buyers participate ────
      if (isEarlyAccess) {
        const isPro = await this.proEntitlementService.isPro(userId);
        if (!isPro) return false;
      }

      // ── Subscription gate: shared purchases require active subscription ──
      if (exclusivityChoice === 'non_exclusive') {
        const isPro = await this.proEntitlementService.isPro(userId);
        if (!isPro) return false;
      }

      // ── Market + type filters ───────────────────────────────────────────
      const hasMarketMatch =
        (rule.market_filters || []).length === 0 ||
        (rule.market_filters || []).includes(lead.market);
      if (!hasMarketMatch) return false;

      const typeFilters = rule.lead_type_filters || [];
      if (typeFilters.length > 0 && !typeFilters.includes(lead.lead_type)) {
        return false;
      }

      // ── Slot availability checks ────────────────────────────────────────
      if (exclusivityChoice === 'exclusive' && lead.non_exclusive_buyers_count > 0) {
        return false;
      }
      if (exclusivityChoice === 'non_exclusive' &&
          lead.non_exclusive_buyers_count >= lead.max_non_exclusive_buyers) {
        return false;
      }

      // ── Canonical pricing ───────────────────────────────────────────────
      const rawExclusive = BigInt(lead.exclusive_price_cents ?? lead.price_cents);
      const rawShared = this.canonicalSharedPrice(lead);
      const rawPrice = exclusivityChoice === 'exclusive' ? rawExclusive : rawShared;

      const effectivePrice = await this.proEntitlementService.discountedPriceCents(
        userId,
        rawPrice,
      );

      // ── Price ceiling check ─────────────────────────────────────────────
      if (rule.max_lead_price_cents != null) {
        if (effectivePrice > BigInt(rule.max_lead_price_cents)) return false;
      }

      // ── Wallet balance check ────────────────────────────────────────────
      const wallet = await this.walletRepo.findOne({
        where: { user: { id: userId } },
      });
      if (!wallet) return false;

      const balance = BigInt(wallet.balance_cents);
      if (balance < effectivePrice) return false;

      const minReserve = BigInt(rule.min_wallet_balance_cents ?? '0');
      if (balance - effectivePrice < minReserve) return false;

      // ── Lead-count caps ─────────────────────────────────────────────────
      const maxPerDay = rule.max_per_day ?? rule.max_leads_per_day;
      if (maxPerDay != null) {
        const purchasedToday = await this.leadAssignmentRepo.count({
          where: {
            buyer: { id: userId },
            created_at: MoreThanOrEqual(startOfDay),
          },
        });
        if (purchasedToday >= maxPerDay) return false;
      }

      if (rule.max_leads_per_week != null) {
        const n = await this.leadAssignmentRepo
          .createQueryBuilder('a')
          .where('a.buyer_id = :userId', { userId })
          .andWhere('a.created_at >= :d', { d: startOfWeek })
          .getCount();
        if (n >= rule.max_leads_per_week) return false;
      }

      if (rule.max_leads_per_month != null) {
        const n = await this.leadAssignmentRepo
          .createQueryBuilder('a')
          .where('a.buyer_id = :userId', { userId })
          .andWhere('a.created_at >= :d', { d: startOfMonth })
          .getCount();
        if (n >= rule.max_leads_per_month) return false;
      }

      // ── Spend caps ──────────────────────────────────────────────────────
      const sumSpend = async (since: Date): Promise<bigint> => {
        const raw = await this.leadAssignmentRepo
          .createQueryBuilder('a')
          .select('COALESCE(SUM(a.amount_charged_cents), 0)', 'sum')
          .where('a.buyer_id = :userId', { userId })
          .andWhere('a.created_at >= :d', { d: since })
          .getRawOne<{ sum: string }>();
        return BigInt(raw?.sum ?? '0');
      };

      if (rule.max_spend_per_day_cents != null) {
        const spent = await sumSpend(startOfDay);
        if (spent + effectivePrice > BigInt(rule.max_spend_per_day_cents)) return false;
      }
      if (rule.max_spend_per_week_cents != null) {
        const spent = await sumSpend(startOfWeek);
        if (spent + effectivePrice > BigInt(rule.max_spend_per_week_cents)) return false;
      }
      if (rule.max_spend_per_month_cents != null) {
        const spent = await sumSpend(startOfMonth);
        if (spent + effectivePrice > BigInt(rule.max_spend_per_month_cents)) return false;
      }

      // ── Cooldown ────────────────────────────────────────────────────────
      if (rule.cooldown_minutes > 0) {
        const last = await this.leadAssignmentRepo.findOne({
          where: { buyer: { id: userId } },
          order: { created_at: 'DESC' },
        });
        if (last) {
          const mins =
            (Date.now() - new Date(last.created_at).getTime()) / 60000;
          if (mins < rule.cooldown_minutes) return false;
        }
      }

      // ── Attempt purchase ────────────────────────────────────────────────
      try {
        await this.leadsService.buyLead(
          userId,
          lead.id,
          PurchaseType.AUTO_BUY,
          exclusivityChoice,
        );

        // ── Merry-go-round advance ──────────────────────────────────────
        const maxPos = rules.reduce(
          (acc, r) => Math.max(acc, r.rotation_position ?? 0),
          0,
        );
        rule.rotation_position = maxPos + 1;
        await this.distributionRuleRepo.save(rule);

        this.logger.log(
          `Merry-go-round: assigned lead ${lead.id} to user ${userId} ` +
          `(${exclusivityChoice}). New rotation_position=${rule.rotation_position}`,
        );
        return true;
      } catch (error) {
        // BadRequestException = business logic rejection (already sold, cap hit, etc.)
        // ForbiddenException  = subscription/early-access gate — skip silently
        if (
          error instanceof BadRequestException ||
          error instanceof ForbiddenException
        ) {
          return false;
        }
        this.logger.error(
          `Failed auto distribution for lead ${lead.id} and user ${userId}`,
          error instanceof Error ? error.stack : undefined,
        );
        return false;
      }
    };

    // ── Pass 1: Try exclusive-preference rules first ───────────────────────
    for (const rule of exclusiveRules) {
      const assigned = await tryRule(rule, 'exclusive');
      if (assigned) return;
    }

    // ── Pass 2: Try shared rules — Pro subscribers only ───────────────────
    for (const rule of sharedRules) {
      const exclusivityPref: string = rule.exclusivity_preference ?? 'both';
      let exclusivityChoice: ExclusivityChoice | null = null;

      if (exclusivityPref === 'non_exclusive_only') {
        if (lead.non_exclusive_buyers_count >= lead.max_non_exclusive_buyers) continue;
        exclusivityChoice = 'non_exclusive';
      } else {
        // 'both' — prefer shared if slots remain, otherwise fall through to exclusive
        if (lead.non_exclusive_buyers_count < lead.max_non_exclusive_buyers) {
          exclusivityChoice = 'non_exclusive';
        } else if (lead.non_exclusive_buyers_count === 0) {
          exclusivityChoice = 'exclusive';
        } else {
          continue;
        }
      }

      const assigned = await tryRule(rule, exclusivityChoice);
      if (assigned) return;
    }

    await this.scheduleRetryIfNeeded(lead.id, settings);
  }

  private async scheduleRetryIfNeeded(
    leadId: string,
    settings: DistributionEngineSettings,
  ) {
    const fresh = await this.leadRepo.findOne({ where: { id: leadId } });
    if (!fresh || fresh.status !== LeadStatus.AVAILABLE) return;

    fresh.distribution_run_count = (fresh.distribution_run_count ?? 0) + 1;
    fresh.last_distribution_at = new Date();
    await this.leadRepo.save(fresh);

    const maxRuns = settings.max_auto_distribution_runs ?? 10;
    const cooldownMin = settings.cooldown_minutes_between_runs ?? 15;
    if (fresh.distribution_run_count < maxRuns) {
      await this.distributionService.enqueueLeadDistribution(leadId, {
        delay: cooldownMin * 60 * 1000,
      });
    }
  }
}
