import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async get(userId: string) {
    const row = await this.repo.findOne({
      where: { user: { id: userId } },
    });

    if (!row) throw new NotFoundException('Onboarding not found');

    return row;
  }

  async update(userId: string, dto: UpdateOnboardingDto) {
    const row = await this.repo.findOne({
      where: { user: { id: userId } },
    });

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
    */
    if (
      dto.completed_at != null &&
      !wasAlreadyCompleted
    ) {
      await this.applyInitialFundingFromOnboardingData(userId, row);
    }

    return this.repo.save(row);
  }

  /**
   * Reads merged `data.wallet_amount` (string dollars from UI), credits once.
   */
  private async applyInitialFundingFromOnboardingData(
    userId: string,
    row: OnboardingProgress,
  ) {
    const data = row.data || {};
    if (data.skipped === true) {
      return;
    }
    if (data.initial_funding_applied === true) {
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
    );

    row.data = {
      ...data,
      initial_funding_applied: true,
      initial_funding_credited_cents: cents,
    };
  }
}
