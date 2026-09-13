import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { User } from '../entities/user.entity';
import { Subscription } from '../entities/subscription.entity';
import { WalletAccount } from '../entities/wallet-account.entity';
import { TermsAcceptance } from '../entities/terms-acceptance.entity';
import { PlanType } from '../../common/enums/plan-type.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { UpdateDistributionRuleDto } from './dto/update-distribution-rule.dto';

@Injectable()
export class DistributionRulesService {
  constructor(
    @InjectRepository(DistributionRule)
    private readonly ruleRepo: Repository<DistributionRule>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(WalletAccount)
    private readonly walletRepo: Repository<WalletAccount>,
    @InjectRepository(TermsAcceptance)
    private readonly termsRepo: Repository<TermsAcceptance>,
    private readonly config: ConfigService,
  ) {}

  private async assertDistributionUnlocked(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user?.distribution_locked) {
      throw new ForbiddenException(
        'Distribution settings are locked for your account. Contact support.',
      );
    }
  }

  private async hasProAutoPurchaseAccess(userId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepo.findOne({
      where: {
        user: { id: userId },
        plan_type: PlanType.PRO,
      },
      order: { created_at: 'DESC' },
    });

    if (!subscription) return false;
    if (subscription.status === SubscriptionStatus.ACTIVE) return true;
    return (
      subscription.status === SubscriptionStatus.CANCELLED &&
      subscription.current_period_end != null &&
      new Date(subscription.current_period_end) > new Date()
    );
  }

  private withProAccess(rule: DistributionRule, proAutoPurchaseEligible: boolean) {
    return {
      ...rule,
      pro_auto_purchase_eligible: proAutoPurchaseEligible,
    };
  }

  /**
   * Non-Pro users may enable autobuy, but only after accepting the full-price
   * disclaimer at least once. Pro users never need to accept it — they get
   * discounted non-exclusive pricing, not the full exclusive price.
   */
  private applyAutobuyDisclaimer(
    rule: DistributionRule,
    dto: UpdateDistributionRuleDto,
    proAutoPurchaseEligible: boolean,
  ) {
    const turningOn = dto.participation_enabled === true && !rule.participation_enabled;
    if (turningOn && !proAutoPurchaseEligible) {
      const alreadyAccepted = rule.autobuy_disclaimer_accepted_at != null;
      if (!alreadyAccepted && dto.autobuy_disclaimer_accepted !== true) {
        throw new ForbiddenException(
          'You are not currently subscribed. If you turn on autobuy, you agree to be charged the full lead price for each lead purchased automatically. Please accept the disclaimer to continue.',
        );
      }
    }
    if (dto.autobuy_disclaimer_accepted === true) {
      rule.autobuy_disclaimer_accepted_at = new Date();
    }
  }

  async listForUser(userId: string) {
    const [rules, proAutoPurchaseEligible] = await Promise.all([
      this.ruleRepo.find({
        where: { user: { id: userId } },
        order: { created_at: 'ASC' },
      }),
      this.hasProAutoPurchaseAccess(userId),
    ]);
    return rules.map((rule) => this.withProAccess(rule, proAutoPurchaseEligible));
  }

  async getMe(userId: string) {
    const [rule, proAutoPurchaseEligible] = await Promise.all([
      this.ruleRepo.findOne({
        where: { user: { id: userId } },
        order: { created_at: 'ASC' },
      }),
      this.hasProAutoPurchaseAccess(userId),
    ]);
    if (!rule) throw new NotFoundException('No distribution rule found — complete onboarding first');
    return this.withProAccess(rule, proAutoPurchaseEligible);
  }

  async upsertMe(userId: string, dto: UpdateDistributionRuleDto) {
    await this.assertDistributionUnlocked(userId);
    const proAutoPurchaseEligible = await this.hasProAutoPurchaseAccess(userId);
    if (
      dto.exclusivity_preference !== undefined &&
      dto.exclusivity_preference !== 'exclusive_only' &&
      !proAutoPurchaseEligible
    ) {
      throw new ForbiddenException(
        'Non-exclusive lead preferences require an active Pro subscription. Please set your purchase type to Exclusive Only, or upgrade to Pro.',
      );
    }
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
        property_type_filters: [],
        min_wallet_balance_cents: '0',
        cooldown_minutes: 0,
        rotation_position: 0,
      });
    }

    this.applyAutobuyDisclaimer(rule, dto, proAutoPurchaseEligible);

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
    if (dto.property_type_filters !== undefined) rule.property_type_filters = dto.property_type_filters;
    if (dto.is_active !== undefined) rule.is_active = dto.is_active;
    if (dto.exclusivity_preference !== undefined) rule.exclusivity_preference = dto.exclusivity_preference;
    if (dto.max_lead_price_cents !== undefined) {
      rule.max_lead_price_cents = dto.max_lead_price_cents === null ? null : String(dto.max_lead_price_cents);
    }

    const saved = await this.ruleRepo.save(rule);
    return this.withProAccess(saved, proAutoPurchaseEligible);
  }

  /**
   * Builds the readiness checklist shared by getLaunchChecklist and
   * launchDistribution. CRM connection is deliberately NOT part of this list —
   * the client's own rule allows skipping CRM setup.
   */
  private async buildChecklist(userId: string, rule: DistributionRule | null) {
    const termsVersion = this.config.get<string>('TERMS_VERSION') ?? '2025-01';
    const [termsRecord, wallet, user] = await Promise.all([
      this.termsRepo.findOne({ where: { user: { id: userId }, terms_version: termsVersion } }),
      this.walletRepo.findOne({ where: { user: { id: userId } } }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    return {
      terms_accepted: termsRecord !== null,
      wallet_funded: Number(wallet?.balance_cents ?? 0) > 0,
      has_filters:
        (rule?.market_filters?.length ?? 0) > 0 || (rule?.lead_type_filters?.length ?? 0) > 0,
      property_type_selected: (rule?.property_type_filters?.length ?? 0) > 0,
      phone_verified: user?.phone_verified === true,
      distribution_limits_set:
        rule?.max_leads_per_day != null ||
        rule?.max_leads_per_week != null ||
        rule?.max_leads_per_month != null,
      participation_enabled: rule?.participation_enabled === true,
    };
  }

  /**
   * Verifies all prerequisites and sets launched_at on the user's rule.
   * Returns a checklist so the frontend can show which gates passed/failed.
   */
  async launchDistribution(userId: string): Promise<{
    ok: boolean;
    launched_at: Date | null;
    checklist: Record<string, boolean>;
  }> {
    const rule = await this.ruleRepo.findOne({
      where: { user: { id: userId } },
      order: { created_at: 'ASC' },
    });
    if (!rule) throw new NotFoundException('No distribution rule found — complete onboarding first');

    const checklist = await this.buildChecklist(userId, rule);

    const allPassed = Object.values(checklist).every(Boolean);
    if (!allPassed) {
      throw new BadRequestException({ message: 'Not all launch prerequisites are met', checklist });
    }

    rule.launched_at = new Date();
    await this.ruleRepo.save(rule);

    return { ok: true, launched_at: rule.launched_at, checklist };
  }

  /** Returns the launch checklist without launching — for frontend display. */
  async getLaunchChecklist(userId: string): Promise<{
    launched_at: Date | null;
    checklist: Record<string, boolean>;
  }> {
    const rule = await this.ruleRepo.findOne({
      where: { user: { id: userId } },
      order: { created_at: 'ASC' },
    });

    const checklist = await this.buildChecklist(userId, rule);
    return { launched_at: rule?.launched_at ?? null, checklist };
  }

  async updateOwnRule(userId: string, ruleId: string, dto: UpdateDistributionRuleDto) {
    await this.assertDistributionUnlocked(userId);
    const proAutoPurchaseEligible = await this.hasProAutoPurchaseAccess(userId);
    if (
      dto.exclusivity_preference !== undefined &&
      dto.exclusivity_preference !== 'exclusive_only' &&
      !proAutoPurchaseEligible
    ) {
      throw new ForbiddenException(
        'Non-exclusive lead preferences require an active Pro subscription. Please set your purchase type to Exclusive Only, or upgrade to Pro.',
      );
    }
    const rule = await this.ruleRepo.findOne({
      where: { id: ruleId },
      relations: { user: true },
    });
    if (!rule) throw new NotFoundException('Rule not found');
    if (rule.user.id !== userId) throw new ForbiddenException('Not your rule');

    this.applyAutobuyDisclaimer(rule, dto, proAutoPurchaseEligible);

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
    if (dto.property_type_filters !== undefined) {
      rule.property_type_filters = dto.property_type_filters;
    }
    if (dto.is_active !== undefined) rule.is_active = dto.is_active;
    if (dto.exclusivity_preference !== undefined) rule.exclusivity_preference = dto.exclusivity_preference;
    if (dto.max_lead_price_cents !== undefined) {
      rule.max_lead_price_cents = dto.max_lead_price_cents === null ? null : String(dto.max_lead_price_cents);
    }

    const saved = await this.ruleRepo.save(rule);
    return this.withProAccess(saved, proAutoPurchaseEligible);
  }
}
