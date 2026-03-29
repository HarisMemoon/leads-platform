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
import { Subscription } from '../entities/subscription.entity';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { WalletAccount } from '../entities/wallet-account.entity';
import { DistributionEngineSettings } from '../entities/distribution-engine-settings.entity';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { PurchaseType } from '../../common/enums/purchase-type.enum';
import { LeadsService } from '../leads/leads.service';

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
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
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
  ) {}

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

    const subscriptions = await this.subscriptionRepo.find({
      where: { status: SubscriptionStatus.ACTIVE },
      relations: { user: true },
      order: { priority_weight: 'DESC' },
    });

    if (subscriptions.length === 0) {
      await this.scheduleRetryIfNeeded(lead.id, settings);
      return;
    }

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
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    const dow = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dow);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const ruleByUserId = new Map(rules.map((rule) => [rule.user.id, rule]));
    let sortedEligibleSubscriptions = subscriptions.filter((subscription) =>
      ruleByUserId.has(subscription.user.id),
    );

    sortedEligibleSubscriptions.sort((a, b) => {
      const ra = ruleByUserId.get(a.user.id)!;
      const rb = ruleByUserId.get(b.user.id)!;
      if (ra.rotation_position !== rb.rotation_position) {
        return ra.rotation_position - rb.rotation_position;
      }
      return (b.priority_weight ?? 0) - (a.priority_weight ?? 0);
    });

    for (const subscription of sortedEligibleSubscriptions) {
      const userId = subscription.user.id;
      const rule = ruleByUserId.get(userId);
      if (!rule) continue;

      if (
        subscription.monthly_lead_limit !== null &&
        subscription.leads_used_this_period >= subscription.monthly_lead_limit
      ) {
        continue;
      }

      const hasMarketMatch =
        (rule.market_filters || []).length === 0 ||
        (rule.market_filters || []).includes(lead.market);
      if (!hasMarketMatch) {
        continue;
      }

      const typeFilters = rule.lead_type_filters || [];
      if (typeFilters.length > 0 && !typeFilters.includes(lead.lead_type)) {
        continue;
      }

      const wallet = await this.walletRepo.findOne({
        where: { user: { id: userId } },
      });
      if (!wallet) continue;

      const price = BigInt(lead.price_cents);
      const balance = BigInt(wallet.balance_cents);
      if (balance < price) {
        continue;
      }

      const minReserve = BigInt(rule.min_wallet_balance_cents ?? '0');
      if (balance - price < minReserve) {
        continue;
      }

      const maxPerDay = rule.max_per_day ?? rule.max_leads_per_day;
      if (maxPerDay !== null) {
        const purchasedToday = await this.leadAssignmentRepo.count({
          where: {
            buyer: { id: userId },
            created_at: MoreThanOrEqual(startOfDay),
          },
        });
        if (purchasedToday >= maxPerDay) {
          continue;
        }
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

      const sumSpend = async (since: Date) => {
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
        if (spent + price > BigInt(rule.max_spend_per_day_cents)) continue;
      }
      if (rule.max_spend_per_week_cents != null) {
        const spent = await sumSpend(startOfWeek);
        if (spent + price > BigInt(rule.max_spend_per_week_cents)) continue;
      }
      if (rule.max_spend_per_month_cents != null) {
        const spent = await sumSpend(startOfMonth);
        if (spent + price > BigInt(rule.max_spend_per_month_cents)) continue;
      }

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

      try {
        await this.leadsService.buyLead(userId, lead.id, PurchaseType.AUTO_BUY);
        subscription.leads_used_this_period += 1;
        await this.subscriptionRepo.save(subscription);
        return;
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
