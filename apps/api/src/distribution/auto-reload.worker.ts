import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WalletAccount } from '../entities/wallet-account.entity';
import { StripeService } from '../stripe/stripe.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Default: every 2 minutes. Override with AUTO_RELOAD_CRON (e.g. `* * * * *` every minute in dev). */
const AUTO_RELOAD_CRON =
  process.env.AUTO_RELOAD_CRON?.trim() || '*/2 * * * *';

@Injectable()
export class AutoReloadWorker {
  private readonly logger = new Logger(AutoReloadWorker.name);
  private readonly workerEnabled: boolean;
  private warnedDisabled = false;

  constructor(
    @InjectRepository(WalletAccount)
    private readonly walletRepo: Repository<WalletAccount>,
    private readonly stripeService: StripeService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {
    const raw = (process.env.AUTO_RELOAD_WORKER_ENABLED ?? '').trim().toLowerCase();
    if (raw === 'true' || raw === '1' || raw === 'yes') {
      this.workerEnabled = true;
    } else if (raw === 'false' || raw === '0' || raw === 'no') {
      this.workerEnabled = false;
    } else {
      // Safety default: in development, avoid accidental double-charging when a hosted
      // environment and a local environment point to the same DB + Stripe account.
      this.workerEnabled = process.env.NODE_ENV === 'production';
    }
  }

  @Cron(AUTO_RELOAD_CRON)
  async runAutoReload() {
    if (!this.workerEnabled) {
      if (!this.warnedDisabled) {
        this.logger.warn(
          'Auto-reload worker is disabled (set AUTO_RELOAD_WORKER_ENABLED=true to enable in this environment).',
        );
        this.warnedDisabled = true;
      }
      return;
    }

    const candidates = await this.walletRepo
      .createQueryBuilder('w')
      .innerJoinAndSelect('w.user', 'u')
      .where('w.auto_reload_enabled = :enabled', { enabled: true })
      .andWhere('w.auto_reload_opt_in = :optIn', { optIn: true })
      .andWhere('w.auto_reload_threshold_cents IS NOT NULL')
      .andWhere('w.auto_reload_amount_cents IS NOT NULL')
      .andWhere('w.stripe_payment_method_id IS NOT NULL')
      .getMany();

    // bigint comparisons — must match product copy: "reload when balance drops *below*"
    // the threshold (strict `<`). Using `<=` lets a refill that lands exactly on the
    // threshold stay "eligible" forever when reload_amount is too small, causing
    // repeated charges every cron tick.
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
        BigInt(wallet.balance_cents) <
        BigInt(wallet.auto_reload_threshold_cents)
      );
    });

    for (const wallet of eligible) {
      const lockKey = `wallet-auto-reload:${wallet.id}`;
      const runner = this.dataSource.createQueryRunner();
      let hasLock = false;
      try {
        await runner.connect();
        const lockRows = await runner.query(
          `SELECT pg_try_advisory_lock(hashtext($1::text)::bigint) AS locked`,
          [lockKey],
        );
        hasLock =
          Array.isArray(lockRows) &&
          lockRows.length > 0 &&
          (lockRows[0].locked === true || lockRows[0].locked === 't');
        if (!hasLock) {
          this.logger.debug(
            `Auto-reload skipped for wallet ${wallet.id}: lock already held by another worker`,
          );
          continue;
        }

        const fresh = await runner.manager
          .getRepository(WalletAccount)
          .createQueryBuilder('w')
          .innerJoinAndSelect('w.user', 'u')
          .where('w.id = :id', { id: wallet.id })
          .getOne();

        if (!fresh) {
          continue;
        }
        if (
          !fresh.auto_reload_enabled ||
          !fresh.auto_reload_opt_in ||
          !fresh.auto_reload_threshold_cents ||
          !fresh.auto_reload_amount_cents ||
          !fresh.stripe_payment_method_id ||
          !fresh.user?.id
        ) {
          continue;
        }
        if (
          BigInt(fresh.balance_cents) >= BigInt(fresh.auto_reload_threshold_cents)
        ) {
          continue;
        }

        const paymentMethodId = fresh.stripe_payment_method_id;
        if (!paymentMethodId) {
          continue;
        }

        const amount = Number(fresh.auto_reload_amount_cents);
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          continue;
        }

        this.logger.log(
          `Auto-reload: wallet ${fresh.id} balance=${fresh.balance_cents} threshold=${fresh.auto_reload_threshold_cents} charging ${amount}c`,
        );

        await this.stripeService.chargeWalletAutoReload(
          fresh.user.id,
          amount,
          paymentMethodId,
          fresh.user.stripe_customer_id,
          { balanceCentsForIdempotency: fresh.balance_cents },
        );

        // Success — notify user (fire-and-forget)
        const estimatedNewBalance = Number(fresh.balance_cents) + amount;
        void this.notificationsService
          .notifyAutoRefillSuccess(fresh.user.id, amount, estimatedNewBalance)
          .catch((e) => this.logger.warn(`Auto-refill success notification failed: ${e instanceof Error ? e.message : e}`));

      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(
          `Auto-reload failed for wallet ${wallet.id} (user ${wallet.user?.id ?? 'unknown'}): ${message}`,
        );

        // Failure — notify user using outer wallet reference (fire-and-forget)
        if (wallet.user?.id) {
          const failAmount = Number(wallet.auto_reload_amount_cents ?? 0);
          void this.notificationsService
            .notifyAutoRefillFailed(wallet.user.id, failAmount)
            .catch((e) => this.logger.warn(`Auto-refill failure notification failed: ${e instanceof Error ? e.message : e}`));
        }
      } finally {
        if (hasLock) {
          try {
            await runner.query(
              `SELECT pg_advisory_unlock(hashtext($1::text)::bigint)`,
              [lockKey],
            );
          } catch {
            // best-effort unlock; releasing the runner closes the session anyway.
          }
        }
        await runner.release();
      }
    }
  }
}

