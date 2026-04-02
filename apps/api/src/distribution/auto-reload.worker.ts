import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletAccount } from '../entities/wallet-account.entity';
import { StripeService } from '../stripe/stripe.service';

/** Default: every 2 minutes. Override with AUTO_RELOAD_CRON (e.g. `* * * * *` every minute in dev). */
const AUTO_RELOAD_CRON =
  process.env.AUTO_RELOAD_CRON?.trim() || '*/2 * * * *';

@Injectable()
export class AutoReloadWorker {
  private readonly logger = new Logger(AutoReloadWorker.name);

  constructor(
    @InjectRepository(WalletAccount)
    private readonly walletRepo: Repository<WalletAccount>,
    private readonly stripeService: StripeService,
  ) {}

  @Cron(AUTO_RELOAD_CRON)
  async runAutoReload() {
    const candidates = await this.walletRepo
      .createQueryBuilder('w')
      .innerJoinAndSelect('w.user', 'u')
      .where('w.auto_reload_enabled = :enabled', { enabled: true })
      .andWhere('w.auto_reload_opt_in = :optIn', { optIn: true })
      .andWhere('w.auto_reload_threshold_cents IS NOT NULL')
      .andWhere('w.auto_reload_amount_cents IS NOT NULL')
      .andWhere('w.stripe_payment_method_id IS NOT NULL')
      .getMany();

    // bigint comparisons — reload when balance is at or below the configured floor.
    const eligible = candidates.filter((wallet) => {
      if (
        !wallet.auto_reload_threshold_cents ||
        !wallet.auto_reload_amount_cents ||
        !wallet.stripe_payment_method_id ||
        !wallet.user?.id
      ) {
        return false;
      }
      return (
        BigInt(wallet.balance_cents) <=
        BigInt(wallet.auto_reload_threshold_cents)
      );
    });

    for (const wallet of eligible) {
      try {
        const paymentMethodId = wallet.stripe_payment_method_id;
        if (!paymentMethodId) {
          continue;
        }

        const amount = Number(wallet.auto_reload_amount_cents);
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          continue;
        }

        this.logger.log(
          `Auto-reload: wallet ${wallet.id} balance=${wallet.balance_cents} threshold=${wallet.auto_reload_threshold_cents} charging ${amount}c`,
        );

        await this.stripeService.chargeWalletAutoReload(
          wallet.user.id,
          amount,
          paymentMethodId,
          wallet.user.stripe_customer_id,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(
          `Auto-reload failed for wallet ${wallet.id} (user ${wallet.user?.id ?? 'unknown'}): ${message}`,
        );
      }
    }
  }
}

