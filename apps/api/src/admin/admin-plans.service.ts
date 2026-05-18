import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { Subscription } from '../entities/subscription.entity';
import { PlanType } from '../../common/enums/plan-type.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { PatchPlanDto } from './dto/admin-plan.dto';

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function leadSummaryFromLimit(limit: number | null): string {
  if (limit == null) return 'Unlimited leads per billing period';
  return `Up to ${limit} leads per billing period`;
}

@Injectable()
export class AdminPlansService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  list() {
    return this.planRepo.find({ order: { priority_rank: 'ASC' } });
  }

  async patch(planType: PlanType, dto: PatchPlanDto) {
    const row = await this.planRepo.findOne({ where: { plan_type: planType } });
    if (!row) {
      throw new NotFoundException(`Plan ${planType} not found`);
    }
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.tagline !== undefined) row.tagline = dto.tagline;
    if (dto.monthly_price_cents !== undefined) {
      row.monthly_price_cents = String(dto.monthly_price_cents);
      if (dto.display_price === undefined) {
        row.display_price = formatUsdFromCents(dto.monthly_price_cents);
      }
    }
    if (dto.display_price !== undefined) row.display_price = dto.display_price;
    if (dto.billing_period_label !== undefined)
      row.billing_period_label = dto.billing_period_label;
    if (dto.monthly_lead_limit !== undefined) {
      row.monthly_lead_limit = dto.monthly_lead_limit;
      if (dto.lead_limit_summary === undefined) {
        row.lead_limit_summary = leadSummaryFromLimit(dto.monthly_lead_limit);
      }
    }
    if (dto.lead_limit_summary !== undefined)
      row.lead_limit_summary = dto.lead_limit_summary;
    if (dto.priority_rank !== undefined) row.priority_rank = dto.priority_rank;
    if (dto.priority_label !== undefined) row.priority_label = dto.priority_label;
    if (dto.distribution_summary !== undefined)
      row.distribution_summary = dto.distribution_summary;
    if (dto.included_lead_credits_summary !== undefined)
      row.included_lead_credits_summary = dto.included_lead_credits_summary;
    if (dto.filter_scope !== undefined) row.filter_scope = dto.filter_scope;
    if (dto.card_highlights !== undefined) row.card_highlights = dto.card_highlights;
    if (dto.feature_bullets !== undefined) {
      row.feature_bullets = dto.feature_bullets.slice(0, 4).map((b) => ({
        text: b.text.trim().slice(0, 280),
        visible: !!b.visible,
      }));
    }
    if (dto.is_active !== undefined) row.is_active = dto.is_active;
    const saved = await this.planRepo.save(row);
    await this.subscriptionRepo.update(
      {
        plan_type: planType,
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PAUSED,
        ]),
      },
      { monthly_lead_limit: saved.monthly_lead_limit },
    );
    return saved;
  }
}
