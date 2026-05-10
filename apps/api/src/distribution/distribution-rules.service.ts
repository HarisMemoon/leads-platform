import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { User } from '../entities/user.entity';
import { UpdateDistributionRuleDto } from './dto/update-distribution-rule.dto';

@Injectable()
export class DistributionRulesService {
  constructor(
    @InjectRepository(DistributionRule)
    private readonly ruleRepo: Repository<DistributionRule>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private async assertDistributionUnlocked(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user?.distribution_locked) {
      throw new ForbiddenException(
        'Distribution settings are locked for your account. Contact support.',
      );
    }
  }

  listForUser(userId: string) {
    return this.ruleRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'ASC' },
    });
  }

  async getMe(userId: string): Promise<DistributionRule> {
    const rule = await this.ruleRepo.findOne({
      where: { user: { id: userId } },
      order: { created_at: 'ASC' },
    });
    if (!rule) throw new NotFoundException('No distribution rule found — complete onboarding first');
    return rule;
  }

  async upsertMe(userId: string, dto: UpdateDistributionRuleDto): Promise<DistributionRule> {
    await this.assertDistributionUnlocked(userId);
    let rule = await this.ruleRepo.findOne({
      where: { user: { id: userId } },
      order: { created_at: 'ASC' },
    });

    if (!rule) {
      rule = this.ruleRepo.create({
        user: { id: userId } as any,
        market: 'all',
        participation_enabled: false,
        is_active: true,
        max_per_day: 5,
        market_filters: [],
        lead_type_filters: [],
        min_wallet_balance_cents: '0',
        cooldown_minutes: 0,
        rotation_position: 0,
      });
    }

    if (dto.participation_enabled !== undefined) rule.participation_enabled = dto.participation_enabled;
    if (dto.max_per_day !== undefined) rule.max_per_day = dto.max_per_day;
    if (dto.max_leads_per_day !== undefined) rule.max_leads_per_day = dto.max_leads_per_day;
    if (dto.max_leads_per_week !== undefined) rule.max_leads_per_week = dto.max_leads_per_week;
    if (dto.max_leads_per_month !== undefined) rule.max_leads_per_month = dto.max_leads_per_month;
    if (dto.max_spend_per_day_cents !== undefined) {
      rule.max_spend_per_day_cents = dto.max_spend_per_day_cents === null ? null : String(dto.max_spend_per_day_cents);
    }
    if (dto.max_spend_per_week_cents !== undefined) {
      rule.max_spend_per_week_cents = dto.max_spend_per_week_cents === null ? null : String(dto.max_spend_per_week_cents);
    }
    if (dto.max_spend_per_month_cents !== undefined) {
      rule.max_spend_per_month_cents = dto.max_spend_per_month_cents === null ? null : String(dto.max_spend_per_month_cents);
    }
    if (dto.min_wallet_balance_cents !== undefined) rule.min_wallet_balance_cents = String(dto.min_wallet_balance_cents);
    if (dto.lead_type_filters !== undefined) rule.lead_type_filters = dto.lead_type_filters;
    if (dto.cooldown_minutes !== undefined) rule.cooldown_minutes = dto.cooldown_minutes;
    if (dto.rotation_position !== undefined) rule.rotation_position = dto.rotation_position;
    if (dto.market_filters !== undefined) rule.market_filters = dto.market_filters;
    if (dto.is_active !== undefined) rule.is_active = dto.is_active;
    if (dto.exclusivity_preference !== undefined) rule.exclusivity_preference = dto.exclusivity_preference;
    if (dto.max_lead_price_cents !== undefined) {
      rule.max_lead_price_cents = dto.max_lead_price_cents === null ? null : String(dto.max_lead_price_cents);
    }

    return this.ruleRepo.save(rule);
  }

  async updateOwnRule(userId: string, ruleId: string, dto: UpdateDistributionRuleDto) {
    await this.assertDistributionUnlocked(userId);
    const rule = await this.ruleRepo.findOne({
      where: { id: ruleId },
      relations: { user: true },
    });
    if (!rule) throw new NotFoundException('Rule not found');
    if (rule.user.id !== userId) throw new ForbiddenException('Not your rule');

    if (dto.participation_enabled !== undefined) {
      rule.participation_enabled = dto.participation_enabled;
    }
    if (dto.max_per_day !== undefined) rule.max_per_day = dto.max_per_day;
    if (dto.max_leads_per_day !== undefined) {
      rule.max_leads_per_day = dto.max_leads_per_day;
    }
    if (dto.max_leads_per_week !== undefined) {
      rule.max_leads_per_week = dto.max_leads_per_week;
    }
    if (dto.max_leads_per_month !== undefined) {
      rule.max_leads_per_month = dto.max_leads_per_month;
    }
    if (dto.max_spend_per_day_cents !== undefined) {
      rule.max_spend_per_day_cents =
        dto.max_spend_per_day_cents === null
          ? null
          : String(dto.max_spend_per_day_cents);
    }
    if (dto.max_spend_per_week_cents !== undefined) {
      rule.max_spend_per_week_cents =
        dto.max_spend_per_week_cents === null
          ? null
          : String(dto.max_spend_per_week_cents);
    }
    if (dto.max_spend_per_month_cents !== undefined) {
      rule.max_spend_per_month_cents =
        dto.max_spend_per_month_cents === null
          ? null
          : String(dto.max_spend_per_month_cents);
    }
    if (dto.min_wallet_balance_cents !== undefined) {
      rule.min_wallet_balance_cents = String(dto.min_wallet_balance_cents);
    }
    if (dto.lead_type_filters !== undefined) {
      rule.lead_type_filters = dto.lead_type_filters;
    }
    if (dto.cooldown_minutes !== undefined) {
      rule.cooldown_minutes = dto.cooldown_minutes;
    }
    if (dto.rotation_position !== undefined) {
      rule.rotation_position = dto.rotation_position;
    }
    if (dto.market_filters !== undefined) {
      rule.market_filters = dto.market_filters;
    }
    if (dto.is_active !== undefined) rule.is_active = dto.is_active;
    if (dto.exclusivity_preference !== undefined) rule.exclusivity_preference = dto.exclusivity_preference;
    if (dto.max_lead_price_cents !== undefined) {
      rule.max_lead_price_cents = dto.max_lead_price_cents === null ? null : String(dto.max_lead_price_cents);
    }

    return this.ruleRepo.save(rule);
  }
}
