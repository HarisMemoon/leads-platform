import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { WalletAccount } from '../entities/wallet-account.entity';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class AutoReloadWorker {
  private readonly logger = new Logger(AutoReloadWorker.name);

  constructor(
    @InjectRepository(WalletAccount)
    private readonly walletRepo: Repository<WalletAccount>,
    private readonly stripeService: StripeService,
  ) {}

  @Cron('*/5 * * * *')
  async runAutoReload() {
    const candidates = await this.walletRepo.find({
      where: {
        auto_reload_enabled: true,
        auto_reload_threshold_cents: Not(IsNull()),
        auto_reload_amount_cents: Not(IsNull()),
        stripe_payment_method_id: Not(IsNull()),
      },
      relations: { user: true },
    });

    // bigint comparisons need SQL side predicate since TypeORM string compare is lexical.
    const eligible = candidates.filter((wallet) => {
      if (
        !wallet.auto_reload_threshold_cents ||
        !wallet.auto_reload_amount_cents ||
        !wallet.stripe_payment_method_id
      ) {
        return false;
      }
      return BigInt(wallet.balance_cents) < BigInt(wallet.auto_reload_threshold_cents);
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

        await this.stripeService.createOffSessionPaymentIntent(
          wallet.user.id,
          amount,
          paymentMethodId,
          wallet.user.stripe_customer_id,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(
          `Auto-reload failed for wallet ${wallet.id} (user ${wallet.user.id}): ${message}`,
        );
      }
    }
  }
}

