import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { OnboardingProgress } from '../entities/onboarding-progress.entity';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { WalletService } from '../wallet/wallet.service';

/** Must match onboarding UI amounts (dollars) */
const ONBOARDING_INITIAL_FUND_DOLLARS = [250, 500, 1000, 2500] as const;

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(OnboardingProgress)
    private repo: Repository<OnboardingProgress>,
    private walletService: WalletService,
    private dataSource: DataSource,
  ) {}

  async get(userId: string) {
    const row = await this.repo.findOne({
      where: { user: { id: userId } },
    });

    if (!row) throw new NotFoundException('Onboarding not found');

    return row;
  }
  
  async update(userId: string, dto: UpdateOnboardingDto) {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager
        .createQueryBuilder(OnboardingProgress, 'o')
        .setLock('pessimistic_write')
        .innerJoinAndSelect('o.user', 'user')
        .where('user.id = :userId', { userId })
        .getOne();

      if (!row) throw new NotFoundException('Onboarding not found');

      const wasAlreadyCompleted = !!row.completed_at;

      if (dto.current_step) {
        row.current_step = Math.min(9, Math.max(1, dto.current_step));
      }

      if (dto.completed_steps) {
        const existing = row.completed_steps || [];
        row.completed_steps = Array.from(new Set([
          ...existing,
          ...dto.completed_steps,
        ]));
      }

      if (dto.data) {
        row.data = {
          ...(row.data || {}),
          ...dto.data,
        };
      }

      if (dto.completed_at !== undefined) {
        row.completed_at = dto.completed_at;
      }

      /*
      When onboarding is completed for the first time, credit the wallet from
      step-4 selection (wallet_amount in dollars). Idempotent via initial_funding_applied.
      Serialized with the row lock above so concurrent "finish" requests cannot double-credit.
      */
      if (dto.completed_at != null && !wasAlreadyCompleted) {
        await this.applyInitialFundingFromOnboardingData(
          userId,
          row,
          manager,
        );
      }

      /*
      Distribution limits are collected at onboarding step 7 (Distribution)
      in the current step order — reordering the wizard means changing this
      threshold, not the number 5 which no longer means anything.
      */
      const shouldSyncDistributionRule =
        row.current_step >= 7 ||
        (row.completed_steps || []).includes(7);

      if (shouldSyncDistributionRule && dto.data) {
        await this.syncDistributionRuleFromOnboardingData(
          userId,
          row.data || {},
          manager,
        );
      }

      return manager.save(row);
    });
  }

  /**
   * Reads merged `data.wallet_amount` (string dollars from UI), credits once.
   */
  private async applyInitialFundingFromOnboardingData(
    userId: string,
    row: OnboardingProgress,
    manager: EntityManager,
  ) {
    const data = row.data || {};
    if (data.skipped === true) {
      return;
    }
    if (data.initial_funding_applied === true) {
      return;
    }
    /*
    Step 4 already credited via Stripe + confirm; do not grant a second synthetic credit.
    */
    if (data.stripe_onboarding_funded === true) {
      return;
    }

    const raw = data.wallet_amount;
    const dollars =
      typeof raw === 'string'
        ? parseInt(raw, 10)
        : typeof raw === 'number'
          ? Math.floor(raw)
          : 0;

    if (!Number.isFinite(dollars) || dollars <= 0) {
      return;
    }

    if (!ONBOARDING_INITIAL_FUND_DOLLARS.includes(dollars as (typeof ONBOARDING_INITIAL_FUND_DOLLARS)[number])) {
      return;
    }

    const cents = dollars * 100;

    await this.walletService.topup(
      userId,
      cents,
      'Onboarding initial funding',
      'onboarding_initial',
      userId,
      manager,
    );

    row.data = {
      ...data,
      initial_funding_applied: true,
      initial_funding_credited_cents: cents,
    };
  }

  private async syncDistributionRuleFromOnboardingData(
    userId: string,
    formData: Record<string, any>,
    manager: EntityManager,
  ) {
    const autoBuy = Boolean(formData.auto_buy);

    const maxPerDayRaw =
      typeof formData.max_per_day === 'string'
        ? Number.parseInt(formData.max_per_day, 10)
        : typeof formData.max_per_day === 'number'
          ? Math.floor(formData.max_per_day)
          : NaN;
    const maxPerDay = Number.isFinite(maxPerDayRaw) && maxPerDayRaw > 0 ? maxPerDayRaw : 5;

    const minBalanceDollarsRaw =
      typeof formData.min_balance === 'string'
        ? Number.parseFloat(formData.min_balance)
        : typeof formData.min_balance === 'number'
          ? formData.min_balance
          : 0;
    const minBalanceDollars = Number.isFinite(minBalanceDollarsRaw)
      ? minBalanceDollarsRaw
      : 0;
    const minWalletBalanceCents = Math.max(0, Math.floor(minBalanceDollars * 100));

    const monthlyBudgetDollarsRaw =
      typeof formData.budget === 'string'
        ? Number.parseFloat(formData.budget)
        : typeof formData.budget === 'number'
          ? formData.budget
          : 0;
    const monthlyBudgetDollars = Number.isFinite(monthlyBudgetDollarsRaw)
      ? monthlyBudgetDollarsRaw
      : 0;
    const maxSpendPerMonthCents = Math.max(0, Math.floor(monthlyBudgetDollars * 100));
    const maxSpendPerDayCents = Math.floor(maxSpendPerMonthCents / 30);
    const maxSpendPerWeekCents = maxSpendPerDayCents * 7;

    const marketFilters = Array.isArray(formData.markets)
      ? formData.markets.filter((v) => typeof v === 'string')
      : [];
    const leadTypeFilters = Array.isArray(formData.lead_types)
      ? formData.lead_types.filter((v) => typeof v === 'string')
      : [];
    const propertyTypeFilters = Array.isArray(formData.property_types)
      ? formData.property_types.filter((v) => typeof v === 'string')
      : [];

    const maxLeadsPerDayRaw = Number.parseInt(formData.max_leads_per_day, 10);
    const maxLeadsPerWeekRaw = Number.parseInt(formData.max_leads_per_week, 10);
    const maxLeadsPerMonthRaw = Number.parseInt(formData.max_leads_per_month, 10);
    const maxLeadsPerDay = Number.isFinite(maxLeadsPerDayRaw) && maxLeadsPerDayRaw > 0 ? maxLeadsPerDayRaw : null;
    const maxLeadsPerWeek = Number.isFinite(maxLeadsPerWeekRaw) && maxLeadsPerWeekRaw > 0 ? maxLeadsPerWeekRaw : null;
    const maxLeadsPerMonth = Number.isFinite(maxLeadsPerMonthRaw) && maxLeadsPerMonthRaw > 0 ? maxLeadsPerMonthRaw : null;

    const market = marketFilters[0] ?? 'default';
    const disclaimerAccepted = Boolean(formData.autobuy_disclaimer_accepted);

    await manager.query(
      `
      INSERT INTO distribution_rules (
        user_id,
        participation_enabled,
        max_per_day,
        min_wallet_balance_cents,
        market_filters,
        lead_type_filters,
        property_type_filters,
        max_leads_per_day,
        max_leads_per_week,
        max_leads_per_month,
        max_spend_per_day_cents,
        max_spend_per_week_cents,
        max_spend_per_month_cents,
        cooldown_minutes,
        market,
        is_active,
        autobuy_disclaimer_accepted_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::text[],
        $6::text[],
        $7::text[],
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        0,
        $14,
        true,
        CASE WHEN $15 THEN now() ELSE NULL END
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        participation_enabled = EXCLUDED.participation_enabled,
        max_per_day = EXCLUDED.max_per_day,
        min_wallet_balance_cents = EXCLUDED.min_wallet_balance_cents,
        market_filters = EXCLUDED.market_filters,
        lead_type_filters = EXCLUDED.lead_type_filters,
        property_type_filters = EXCLUDED.property_type_filters,
        max_leads_per_day = EXCLUDED.max_leads_per_day,
        max_leads_per_week = EXCLUDED.max_leads_per_week,
        max_leads_per_month = EXCLUDED.max_leads_per_month,
        max_spend_per_day_cents = EXCLUDED.max_spend_per_day_cents,
        max_spend_per_week_cents = EXCLUDED.max_spend_per_week_cents,
        max_spend_per_month_cents = EXCLUDED.max_spend_per_month_cents,
        autobuy_disclaimer_accepted_at = COALESCE(
          distribution_rules.autobuy_disclaimer_accepted_at,
          EXCLUDED.autobuy_disclaimer_accepted_at
        ),
        cooldown_minutes = EXCLUDED.cooldown_minutes,
        market = EXCLUDED.market,
        is_active = EXCLUDED.is_active
      `,
      [
        userId,
        autoBuy,
        maxPerDay,
        String(minWalletBalanceCents),
        marketFilters,
        leadTypeFilters,
        propertyTypeFilters,
        maxLeadsPerDay,
        maxLeadsPerWeek,
        maxLeadsPerMonth,
        String(maxSpendPerDayCents),
        String(maxSpendPerWeekCents),
        String(maxSpendPerMonthCents),
        market,
        disclaimerAccepted,
      ],
    );
  }
}
