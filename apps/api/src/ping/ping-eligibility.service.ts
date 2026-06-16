import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { DistributionRule } from '../entities/distribution-rule.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { WalletAccount } from '../entities/wallet-account.entity';
import { TermsAcceptance } from '../entities/terms-acceptance.entity';

const CURRENT_TERMS_VERSION = '2025-01';

export type PingEligibilityInput = {
  buyerId: string;
  priceCents: bigint;
  market: string | null;
  leadType: string;
  now?: Date;
};

export type PingEligibilityResult = {
  eligible: boolean;
  reason?: string;
  distributionRule?: DistributionRule;
};

@Injectable()
export class PingEligibilityService {
  constructor(
    @InjectRepository(DistributionRule)
    private readonly distributionRuleRepo: Repository<DistributionRule>,
    @InjectRepository(WalletAccount)
    private readonly walletRepo: Repository<WalletAccount>,
    @InjectRepository(LeadAssignment)
    private readonly assignmentRepo: Repository<LeadAssignment>,
    @InjectRepository(TermsAcceptance)
    private readonly termsRepo: Repository<TermsAcceptance>,
  ) {}

  async check(input: PingEligibilityInput): Promise<PingEligibilityResult> {
    const rule = await this.distributionRuleRepo.findOne({
      where: { user: { id: input.buyerId } },
      order: { created_at: 'ASC' },
    });

    if (!rule) return { eligible: false, reason: 'distribution_rule_missing' };
    if (!rule.participation_enabled) {
      return { eligible: false, reason: 'distribution_not_enabled', distributionRule: rule };
    }
    if (!rule.is_active) {
      return { eligible: false, reason: 'distribution_paused', distributionRule: rule };
    }

    // Buyer must have accepted terms before receiving auto-delivered leads
    const termsAccepted = await this.termsRepo.findOne({
      where: { user: { id: input.buyerId }, terms_version: CURRENT_TERMS_VERSION },
    });
    if (!termsAccepted) {
      return { eligible: false, reason: 'terms_not_accepted', distributionRule: rule };
    }

    // Buyer must have set at least one filter (market or lead type) before receiving auto-delivered leads.
    // Empty filters means setup is incomplete — skip them to avoid blasting every lead to everyone.
    const marketFilters = rule.market_filters || [];
    const leadTypeFilters = rule.lead_type_filters || [];
    if (marketFilters.length === 0 && leadTypeFilters.length === 0) {
      return { eligible: false, reason: 'no_criteria_set', distributionRule: rule };
    }
    if (
      marketFilters.length > 0 &&
      input.market != null &&
      !marketFilters.map((m) => this.norm(m)).includes(this.norm(input.market))
    ) {
      return { eligible: false, reason: 'market_not_enabled', distributionRule: rule };
    }

    if (
      leadTypeFilters.length > 0 &&
      !leadTypeFilters.map((m) => this.norm(m)).includes(this.norm(input.leadType))
    ) {
      return { eligible: false, reason: 'lead_type_not_enabled', distributionRule: rule };
    }

    if (rule.max_lead_price_cents != null && input.priceCents > BigInt(rule.max_lead_price_cents)) {
      return { eligible: false, reason: 'price_above_rule_ceiling', distributionRule: rule };
    }

    const wallet = await this.walletRepo.findOne({
      where: { user: { id: input.buyerId } },
    });
    if (!wallet) return { eligible: false, reason: 'wallet_missing', distributionRule: rule };

    const balance = BigInt(wallet.balance_cents);
    if (balance < input.priceCents) {
      return { eligible: false, reason: 'insufficient_wallet_balance', distributionRule: rule };
    }

    const minReserve = BigInt(rule.min_wallet_balance_cents ?? '0');
    if (balance - input.priceCents < minReserve) {
      return { eligible: false, reason: 'wallet_reserve_required', distributionRule: rule };
    }

    const now = input.now ?? new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const maxPerDay = rule.max_per_day ?? rule.max_leads_per_day;
    if (maxPerDay != null && (await this.countAssignments(input.buyerId, startOfDay)) >= maxPerDay) {
      return { eligible: false, reason: 'daily_lead_cap_reached', distributionRule: rule };
    }
    if (
      rule.max_leads_per_week != null &&
      (await this.countAssignments(input.buyerId, startOfWeek)) >= rule.max_leads_per_week
    ) {
      return { eligible: false, reason: 'weekly_lead_cap_reached', distributionRule: rule };
    }
    if (
      rule.max_leads_per_month != null &&
      (await this.countAssignments(input.buyerId, startOfMonth)) >= rule.max_leads_per_month
    ) {
      return { eligible: false, reason: 'monthly_lead_cap_reached', distributionRule: rule };
    }

    if (
      rule.max_spend_per_day_cents != null &&
      (await this.sumSpend(input.buyerId, startOfDay)) + input.priceCents > BigInt(rule.max_spend_per_day_cents)
    ) {
      return { eligible: false, reason: 'daily_spend_cap_reached', distributionRule: rule };
    }
    if (
      rule.max_spend_per_week_cents != null &&
      (await this.sumSpend(input.buyerId, startOfWeek)) + input.priceCents > BigInt(rule.max_spend_per_week_cents)
    ) {
      return { eligible: false, reason: 'weekly_spend_cap_reached', distributionRule: rule };
    }
    if (
      rule.max_spend_per_month_cents != null &&
      (await this.sumSpend(input.buyerId, startOfMonth)) + input.priceCents > BigInt(rule.max_spend_per_month_cents)
    ) {
      return { eligible: false, reason: 'monthly_spend_cap_reached', distributionRule: rule };
    }

    if (rule.cooldown_minutes > 0) {
      const last = await this.assignmentRepo.findOne({
        where: { buyer: { id: input.buyerId } },
        order: { created_at: 'DESC' },
      });
      if (last) {
        const minutes = (now.getTime() - new Date(last.created_at).getTime()) / 60000;
        if (minutes < rule.cooldown_minutes) {
          return { eligible: false, reason: 'cooldown_active', distributionRule: rule };
        }
      }
    }

    // Record launch date the first time a buyer passes all checks
    if (!rule.launched_at) {
      rule.launched_at = new Date();
      await this.distributionRuleRepo.save(rule);
    }

    return { eligible: true, distributionRule: rule };
  }

  private countAssignments(buyerId: string, since: Date) {
    return this.assignmentRepo.count({
      where: {
        buyer: { id: buyerId },
        created_at: MoreThanOrEqual(since),
      },
    });
  }

  private async sumSpend(buyerId: string, since: Date): Promise<bigint> {
    const raw = await this.assignmentRepo
      .createQueryBuilder('assignment')
      .select('COALESCE(SUM(assignment.amount_charged_cents), 0)', 'sum')
      .where('assignment.buyer_id = :buyerId', { buyerId })
      .andWhere('assignment.created_at >= :since', { since })
      .getRawOne<{ sum: string }>();
    return BigInt(raw?.sum ?? '0');
  }

  private norm(value: string): string {
    return value.trim().toLowerCase();
  }
}
