import {
  BadRequestException,
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
import { ProEntitlementService } from '../subscriptions/pro-entitlement.service';

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
   * Canonical shared-per-buyer price: exclusive / max_non_exclusive_buyers.
   * Mirrors the formula in LeadsService so all three paths
   * (quote, manual buy, auto-distribution) charge identically.
   */
  private canonicalSharedPrice(lead: Lead): bigint {
    const exclusive = BigInt(lead.exclusive_price_cents ?? lead.price_cents);
    const cap = BigInt(Math.max(1, Number(lead.max_non_exclusive_buyers ?? 3)));
    const computed = exclusive / cap;
    return computed > 0n ? computed : 1n;
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
     * ── Merry-go-round sort ──────────────────────────────────────────────────
     * Sort by rotation_position ASC — whoever has the lowest value goes next.
     * Tiebreak by rule created_at ASC (earliest registered buyer wins the tie).
     * After a successful assignment we bump that buyer's position to the back,
     * guaranteeing true round-robin fairness over time.
     */
    const sortedRules = [...rules].sort((a, b) => {
      const posDiff = (a.rotation_position ?? 0) - (b.rotation_position ?? 0);
      if (posDiff !== 0) return posDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    for (const rule of sortedRules) {
      const userId = rule.user.id;

      // ── Early-access gate: during window, only Pro buyers participate ──────
      if (isEarlyAccess) {
        const isPro = await this.proEntitlementService.isPro(userId);
        if (!isPro) continue;
      }

      // ── Market + type filters ─────────────────────────────────────────────
      const hasMarketMatch =
        (rule.market_filters || []).length === 0 ||
        (rule.market_filters || []).includes(lead.market);
      if (!hasMarketMatch) continue;

      const typeFilters = rule.lead_type_filters || [];
      if (typeFilters.length > 0 && !typeFilters.includes(lead.lead_type)) {
        continue;
      }

      // ── Determine exclusivity choice from rule preference ─────────────────
      const exclusivityPref: string = rule.exclusivity_preference ?? 'both';

      let exclusivityChoice: ExclusivityChoice | null = null;
      if (exclusivityPref === 'exclusive_only') {
        if (lead.non_exclusive_buyers_count > 0) continue;
        exclusivityChoice = 'exclusive';
      } else if (exclusivityPref === 'non_exclusive_only') {
        if (lead.non_exclusive_buyers_count >= lead.max_non_exclusive_buyers) continue;
        exclusivityChoice = 'non_exclusive';
      } else {
        // 'both' — prefer shared if slots remain, otherwise exclusive
        if (lead.non_exclusive_buyers_count < lead.max_non_exclusive_buyers) {
          exclusivityChoice = 'non_exclusive';
        } else if (lead.non_exclusive_buyers_count === 0) {
          exclusivityChoice = 'exclusive';
        } else {
          continue;
        }
      }

      if (exclusivityChoice === null) continue;

      // ── Canonical pricing — same formula as quote + manual buy ────────────
      const rawExclusive = BigInt(lead.exclusive_price_cents ?? lead.price_cents);
      const rawShared = this.canonicalSharedPrice(lead);
      const rawPrice = exclusivityChoice === 'exclusive' ? rawExclusive : rawShared;

      const effectivePrice = await this.proEntitlementService.discountedPriceCents(
        userId,
        rawPrice,
      );

      // ── Price ceiling check ───────────────────────────────────────────────
      if (rule.max_lead_price_cents != null) {
        if (effectivePrice > BigInt(rule.max_lead_price_cents)) continue;
      }

      // ── Wallet balance check ──────────────────────────────────────────────
      const wallet = await this.walletRepo.findOne({
        where: { user: { id: userId } },
      });
      if (!wallet) continue;

      const balance = BigInt(wallet.balance_cents);
      if (balance < effectivePrice) continue;

      const minReserve = BigInt(rule.min_wallet_balance_cents ?? '0');
      if (balance - effectivePrice < minReserve) continue;

      // ── Lead-count caps ───────────────────────────────────────────────────
      const maxPerDay = rule.max_per_day ?? rule.max_leads_per_day;
      if (maxPerDay != null) {
        const purchasedToday = await this.leadAssignmentRepo.count({
          where: {
            buyer: { id: userId },
            created_at: MoreThanOrEqual(startOfDay),
          },
        });
        if (purchasedToday >= maxPerDay) continue;
      }

      if (rule.max_leads_per_week != null) {
        const n = await this.leadAssignmentRepo
          .createQueryBuilder('a')
          .where('a.buyer_id = :userId', { userId })
          .andWhere('a.created_at >= :d', { d: startOfWeek })
          .getCount();
        if (n >= rule.max_leads_per_week) continue;
      }

      if (rule.max_leads_per_month != null) {
        const n = await this.leadAssignmentRepo
          .createQueryBuilder('a')
          .where('a.buyer_id = :userId', { userId })
          .andWhere('a.created_at >= :d', { d: startOfMonth })
          .getCount();
        if (n >= rule.max_leads_per_month) continue;
      }

      // ── Spend caps ────────────────────────────────────────────────────────
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
        if (spent + effectivePrice > BigInt(rule.max_spend_per_day_cents)) continue;
      }
      if (rule.max_spend_per_week_cents != null) {
        const spent = await sumSpend(startOfWeek);
        if (spent + effectivePrice > BigInt(rule.max_spend_per_week_cents)) continue;
      }
      if (rule.max_spend_per_month_cents != null) {
        const spent = await sumSpend(startOfMonth);
        if (spent + effectivePrice > BigInt(rule.max_spend_per_month_cents)) continue;
      }

      // ── Cooldown ──────────────────────────────────────────────────────────
      if (rule.cooldown_minutes > 0) {
        const last = await this.leadAssignmentRepo.findOne({
          where: { buyer: { id: userId } },
          order: { created_at: 'DESC' },
        });
        if (last) {
          const mins =
            (Date.now() - new Date(last.created_at).getTime()) / 60000;
          if (mins < rule.cooldown_minutes) continue;
        }
      }

      // ── Attempt purchase ──────────────────────────────────────────────────
      try {
        await this.leadsService.buyLead(
          userId,
          lead.id,
          PurchaseType.AUTO_BUY,
          exclusivityChoice,
        );

        /*
         * ── Merry-go-round advance ─────────────────────────────────────────
         * Move this buyer to the back of the rotation queue.
         * New position = max position across ALL eligible rules + 1,
         * so they can only be served again after everyone else has had a turn.
         */
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

        return; // success — stop processing for this lead
      } catch (error) {
        if (error instanceof BadRequestException) {
          continue;
        }
        this.logger.error(
          `Failed auto distribution for lead ${lead.id} and user ${userId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
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
