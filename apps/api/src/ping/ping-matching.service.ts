import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BuyerPricingRule } from '../entities/buyer-pricing-rule.entity';
import { LeadPing } from '../entities/lead-ping.entity';
import { PingMatchAudit } from '../entities/ping-match-audit.entity';
import { PingEligibilityService } from './ping-eligibility.service';

export type PingMatchResult = {
  accepted: boolean;
  buyerId?: string;
  pricingRuleId?: string;
  priceCents?: string;
  rejectionReason?: string;
};

type Candidate = {
  rule: BuyerPricingRule;
  price: bigint;
  rankingScore: number;
};

@Injectable()
export class PingMatchingService {
  constructor(
    @InjectRepository(BuyerPricingRule)
    private readonly pricingRuleRepo: Repository<BuyerPricingRule>,
    @InjectRepository(PingMatchAudit)
    private readonly auditRepo: Repository<PingMatchAudit>,
    private readonly eligibilityService: PingEligibilityService,
  ) {}

  async match(ping: LeadPing): Promise<PingMatchResult> {
    const pricingRules = await this.pricingRuleRepo.find({
      where: { is_active: true, paused: false },
      relations: { user: true },
      order: { priority: 'DESC', created_at: 'ASC' },
    });

    const candidates: Candidate[] = [];

    for (const rule of pricingRules) {
      const buyerId = rule.user?.id;
      if (!buyerId) continue;

      if (!rule.user.is_active) {
        await this.audit(ping, rule, false, null, 0, 'buyer_inactive');
        continue;
      }

      const marketMatch = this.matchesPricingRule(rule, ping);
      if (!marketMatch.ok) {
        await this.audit(ping, rule, false, null, 0, marketMatch.reason);
        continue;
      }

      const price = this.resolvePrice(rule);
      if (price == null || price <= 0n) {
        await this.audit(ping, rule, false, null, 0, 'pricing_missing');
        continue;
      }

      const eligibility = await this.eligibilityService.check({
        buyerId,
        priceCents: price,
        market: ping.market,
        leadType: ping.lead_type,
      });
      if (!eligibility.eligible) {
        await this.audit(ping, rule, false, price, 0, eligibility.reason ?? 'not_eligible');
        continue;
      }

      const rankingScore = this.rankingScore(rule, price);
      await this.audit(ping, rule, true, price, rankingScore, null);
      candidates.push({ rule, price, rankingScore });
    }

    if (candidates.length === 0) {
      return { accepted: false, rejectionReason: 'no_eligible_buyers' };
    }

    candidates.sort((a, b) => {
      const priorityDiff = (b.rule.priority ?? 0) - (a.rule.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      if (a.price !== b.price) return a.price > b.price ? -1 : 1;
      return new Date(a.rule.created_at).getTime() - new Date(b.rule.created_at).getTime();
    });

    const winner = candidates[0];
    return {
      accepted: true,
      buyerId: winner.rule.user.id,
      pricingRuleId: winner.rule.id,
      priceCents: winner.price.toString(),
    };
  }

  private matchesPricingRule(
    rule: BuyerPricingRule,
    ping: LeadPing,
  ): { ok: true } | { ok: false; reason: string } {
    if (!this.matchesList(rule.markets, ping.market)) return { ok: false, reason: 'market_mismatch' };
    if (!this.matchesList(rule.states, ping.state)) return { ok: false, reason: 'state_mismatch' };
    if (!this.matchesList(rule.cities, ping.city)) return { ok: false, reason: 'city_mismatch' };
    if (!this.matchesList(rule.zips, ping.zip)) return { ok: false, reason: 'zip_mismatch' };
    if (!this.matchesList(rule.counties, ping.county)) return { ok: false, reason: 'county_mismatch' };
    if (!this.matchesList(rule.property_types, ping.property_type)) {
      return { ok: false, reason: 'property_type_mismatch' };
    }
    if (!this.matchesList(rule.lead_types, ping.lead_type)) return { ok: false, reason: 'lead_type_mismatch' };

    if (rule.exclusivity_preference === 'exclusive_only' && ping.exclusivity_choice !== 'exclusive') {
      return { ok: false, reason: 'requires_exclusive' };
    }
    if (rule.exclusivity_preference === 'non_exclusive_only' && ping.exclusivity_choice !== 'non_exclusive') {
      return { ok: false, reason: 'requires_non_exclusive' };
    }

    return { ok: true };
  }

  private matchesList(list: string[] | null | undefined, value: string | null): boolean {
    if (!list || list.length === 0) return true;
    if (!value) return false;
    const normalizedValue = this.norm(value);
    return list.map((item) => this.norm(item)).includes(normalizedValue);
  }

  private resolvePrice(rule: BuyerPricingRule): bigint | null {
    if (rule.fixed_price_cents != null) return BigInt(rule.fixed_price_cents);
    if (rule.max_bid_cents != null) return BigInt(rule.max_bid_cents);
    return null;
  }

  private rankingScore(rule: BuyerPricingRule, price: bigint): number {
    return Number(BigInt(rule.priority ?? 0) * 1_000_000n + price);
  }

  private async audit(
    ping: LeadPing,
    rule: BuyerPricingRule,
    eligible: boolean,
    price: bigint | null,
    rankingScore: number,
    rejectionReason: string | null,
  ) {
    await this.auditRepo.save(
      this.auditRepo.create({
        ping: { id: ping.id } as LeadPing,
        buyer: rule.user,
        pricing_rule: rule,
        eligible,
        price_cents: price?.toString() ?? null,
        ranking_score: rankingScore,
        rejection_reason: rejectionReason,
        details: {
          rule_name: rule.name,
          priority: rule.priority,
          routing_strategy: rule.routing_strategy,
        },
      }),
    );
  }

  private norm(value: string): string {
    return value.trim().toLowerCase();
  }
}
