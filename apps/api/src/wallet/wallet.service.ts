import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { WalletAccount } from '../entities/wallet-account.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { WalletTransactionType } from '../../common/enums/wallet-transaction-type.enum';
import { UpdateWalletAutoReloadDto } from './dto/update-wallet-auto-reload.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class WalletService {

  constructor(
    @InjectRepository(WalletAccount)
    private walletRepo: Repository<WalletAccount>,

    @InjectRepository(WalletTransaction)
    private txRepo: Repository<WalletTransaction>,

    private dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  private async emitWalletCreditSideEffects(input: {
    userId: string;
    amountCents: number;
    wallet: WalletAccount;
    description: string;
    referenceType: string;
    referenceId: string | null;
  }) {
    try {
      await this.integrationsService.emitCustomWebhookEvent(input.userId, 'wallet_credit_posted', {
        amount_cents: input.amountCents,
        balance_cents: input.wallet.balance_cents,
        description: input.description,
        reference_type: input.referenceType,
        reference_id: input.referenceId,
      });

      if (input.referenceType === 'stripe_topup') {
        await this.notificationsService.notifyWalletFunded(
          input.userId,
          input.amountCents,
          input.wallet.balance_cents,
          input.referenceId,
        );
        return;
      }

      if (input.referenceType === 'refund_approved') {
        return;
      }

      await this.notificationsService.notifyWalletCreditPosted(
        input.userId,
        input.amountCents,
        input.wallet.balance_cents,
        input.description,
        input.referenceId,
      );
    } catch {
      // Never fail the wallet mutation because a downstream notification provider failed.
    }
  }

  /*
  GET WALLET
  */
  async getWallet(userId: string) {

    const wallet = await this.walletRepo.findOne({
      where: { user: { id: userId } }
    });

    if (!wallet) throw new NotFoundException('Wallet not found');

    return wallet;
  }

  /**
   * Credit wallet (simulated / dev top-up, onboarding credit, etc.).
   * @param amountCents amount in cents (bigint-safe via string math inside transaction)
   * @param referenceId optional idempotency key (e.g. user id for onboarding_initial)
   * @param existingManager when provided, runs inside that transaction (no nested transaction)
   */
  async topup(
    userId: string,
    amountCents: number,
    description?: string,
    referenceType = 'dev_topup',
    referenceId: string | null = null,
    existingManager?: EntityManager,
  ) {
    const run = async (manager: EntityManager) => {
      const wallet = await manager
        .createQueryBuilder(WalletAccount, 'w')
        .innerJoin('w.user', 'u')
        .setLock('pessimistic_write')
        .where('u.id = :userId', { userId })
        .getOne();

      if (!wallet) throw new NotFoundException('Wallet not found');

      const currentBalance = BigInt(wallet.balance_cents);
      const creditAmount = BigInt(amountCents);
      const nextBalance = currentBalance + creditAmount;

      wallet.balance_cents = nextBalance.toString();
      await manager.save(wallet);

      const tx = manager.create(WalletTransaction, {
        wallet,
        type: WalletTransactionType.CREDIT,
        amount_cents: creditAmount.toString(),
        balance_after_cents: nextBalance.toString(),
        reference_type: referenceType,
        reference_id: referenceId ?? null,
        description: description || 'Wallet credit',
      });

      await manager.save(tx);

      return wallet;
    };

    if (existingManager) {
      return run(existingManager);
    }
    const wallet = await this.dataSource.transaction(run);
    await this.emitWalletCreditSideEffects({
      userId,
      amountCents,
      wallet,
      description: description || 'Wallet credit',
      referenceType,
      referenceId,
    });
    return wallet;
  }

  async topUp(
    userId: string,
    amountCents: number,
    description?: string,
    referenceType = 'dev_topup',
  ) {
    return this.topup(userId, amountCents, description, referenceType, null);
  }

  /**
   * Credits the wallet for a succeeded Stripe PaymentIntent. Idempotent per
   * `paymentIntentId` so the client can confirm immediately while webhooks still work.
   */
  async applyStripeTopUp(
    userId: string,
    amountCents: number,
    paymentIntentId: string,
    description = 'Stripe top-up',
  ): Promise<WalletAccount> {
    const pi = paymentIntentId.trim();
    let created = false;
    const wallet = await this.dataSource.transaction(async (manager) => {
      /*
      Serialize on PaymentIntent id so webhook + HTTP confirm cannot both pass the
      idempotency check and double-insert rows while only one balance update sticks.
      */
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtext($1::text)::bigint)`,
        [pi],
      );

      /*
      Do not use `if (existing?.wallet)` — TypeORM can return a row without the
      `wallet` relation populated, which skipped the idempotency branch and inserted
      a second `stripe_topup` row for the same PaymentIntent (balance still correct
      only once if the second insert hit a unique index and rolled back, or worse).
      */
      const prior = await manager
        .createQueryBuilder(WalletTransaction, 't')
        .innerJoinAndSelect('t.wallet', 'w')
        .innerJoinAndSelect('w.user', 'u')
        .where('t.reference_type = :rt', { rt: 'stripe_topup' })
        .andWhere('t.reference_id = :rid', { rid: pi })
        .getOne();

      if (prior) {
        if (prior.wallet.user.id !== userId) {
          throw new BadRequestException('Invalid payment intent');
        }
        return manager.findOneOrFail(WalletAccount, {
          where: { user: { id: userId } },
        });
      }

      const wallet = await manager.findOne(WalletAccount, {
        where: { user: { id: userId } },
      });

      if (!wallet) throw new NotFoundException('Wallet not found');

      const currentBalance = BigInt(wallet.balance_cents);
      const creditAmount = BigInt(amountCents);
      const nextBalance = currentBalance + creditAmount;

      wallet.balance_cents = nextBalance.toString();
      await manager.save(wallet);

      await manager.save(
        manager.create(WalletTransaction, {
          wallet,
          type: WalletTransactionType.CREDIT,
          amount_cents: creditAmount.toString(),
          balance_after_cents: nextBalance.toString(),
          reference_type: 'stripe_topup',
          reference_id: pi,
          description: description || 'Stripe top-up',
        }),
      );

      created = true;
      return wallet;
    });
    if (created) {
      await this.emitWalletCreditSideEffects({
        userId,
        amountCents,
        wallet,
        description,
        referenceType: 'stripe_topup',
        referenceId: pi,
      });
    }
    return wallet;
  }

  /**
   * Idempotent wallet credit (e.g. subscription invoice wallet allowance).
   * Same reference_type + reference_id cannot credit twice.
   */
  async applyIdempotentCredit(
    userId: string,
    amountCents: number,
    referenceType: string,
    referenceId: string,
    description: string,
  ): Promise<WalletAccount> {
    const rid = referenceId.trim();
    const rt = referenceType.trim();
    let created = false;
    const wallet = await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1::text)::bigint)`, [
        `${rt}:${rid}`,
      ]);

      const prior = await manager
        .createQueryBuilder(WalletTransaction, 't')
        .innerJoinAndSelect('t.wallet', 'w')
        .innerJoinAndSelect('w.user', 'u')
        .where('t.reference_type = :rt', { rt })
        .andWhere('t.reference_id = :rid', { rid })
        .getOne();

      if (prior) {
        if (prior.wallet.user.id !== userId) {
          throw new BadRequestException('Invalid reference for wallet credit');
        }
        return manager.findOneOrFail(WalletAccount, {
          where: { user: { id: userId } },
        });
      }

      const wallet = await manager.findOne(WalletAccount, {
        where: { user: { id: userId } },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const currentBalance = BigInt(wallet.balance_cents);
      const creditAmount = BigInt(amountCents);
      const nextBalance = currentBalance + creditAmount;
      wallet.balance_cents = nextBalance.toString();
      await manager.save(wallet);
      await manager.save(
        manager.create(WalletTransaction, {
          wallet,
          type: WalletTransactionType.CREDIT,
          amount_cents: creditAmount.toString(),
          balance_after_cents: nextBalance.toString(),
          reference_type: rt,
          reference_id: rid,
          description,
        }),
      );
      created = true;
      return wallet;
    });
    if (created) {
      await this.emitWalletCreditSideEffects({
        userId,
        amountCents,
        wallet,
        description,
        referenceType: rt,
        referenceId: rid,
      });
    }
    return wallet;
  }

  /*
  TRANSACTIONS LIST (paginated; optional credit/debit filter)
  */
  async getTransactions(
    userId: string,
    limit = 10,
    offset = 0,
    type?: 'credit' | 'debit',
  ) {
    const wallet = await this.walletRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!wallet) throw new NotFoundException('Wallet not found');

    const qb = this.txRepo
      .createQueryBuilder('t')
      .where('t.walletId = :wid', { wid: wallet.id })
      .orderBy('t.created_at', 'DESC');

    if (type === 'credit' || type === 'debit') {
      qb.andWhere('t.type = :txType', { txType: type });
    }

    const [items, total] = await qb.take(limit).skip(offset).getManyAndCount();

    return { items, total, limit, offset };
  }

  /** Lifetime totals for wallet hero (not page-limited). */
  async getTransactionTotals(userId: string) {
    const wallet = await this.walletRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const raw = await this.txRepo
      .createQueryBuilder('t')
      .select('COUNT(t.id)::int', 'count')
      .addSelect(
        `COALESCE(SUM(CASE WHEN t.type::text = 'credit' THEN CAST(t.amount_cents AS BIGINT) ELSE 0 END), 0)`,
        'credits',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN t.type::text = 'debit' THEN CAST(t.amount_cents AS BIGINT) ELSE 0 END), 0)`,
        'debits',
      )
      .where('t.walletId = :wid', { wid: wallet.id })
      .getRawOne<{ count: string; credits: string; debits: string }>();

    return {
      transaction_count: Number(raw?.count ?? 0),
      total_credits_cents: String(raw?.credits ?? '0'),
      total_debits_cents: String(raw?.debits ?? '0'),
    };
  }

  async updateAutoReload(userId: string, dto: UpdateWalletAutoReloadDto) {
    const wallet = await this.walletRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    if (dto.auto_reload_enabled) {
      if (
        dto.auto_reload_threshold_cents === undefined ||
        dto.auto_reload_amount_cents === undefined
      ) {
        throw new BadRequestException(
          'Threshold and reload amount are required when auto-reload is enabled.',
        );
      }
      if (!wallet.auto_reload_opt_in) {
        throw new BadRequestException(
          'Enable auto-reload only after you save a card during a wallet top-up: check “Save this card for auto-reload” and complete payment.',
        );
      }
      if (!wallet.stripe_payment_method_id) {
        throw new BadRequestException(
          'No saved card on file. Add funds with a card and check “Save this card for auto-reload” first.',
        );
      }
      wallet.auto_reload_enabled = true;
      wallet.auto_reload_threshold_cents = String(dto.auto_reload_threshold_cents);
      wallet.auto_reload_amount_cents = String(dto.auto_reload_amount_cents);
    } else {
      wallet.auto_reload_enabled = false;
      wallet.auto_reload_threshold_cents = null;
      wallet.auto_reload_amount_cents = null;
    }

    await this.walletRepo.save(wallet);
    return wallet;
  }

  async debitWallet(
    userId: string,
    amountCents: number,
    referenceType: string,
    referenceId: string,
    description: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(WalletAccount, {
        where: { user: { id: userId } },
      });

      if (!wallet) throw new NotFoundException('Wallet not found');

      const currentBalance = BigInt(wallet.balance_cents);
      const debitAmount = BigInt(amountCents);

      if (currentBalance < debitAmount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const nextBalance = currentBalance - debitAmount;
      wallet.balance_cents = nextBalance.toString();
      await queryRunner.manager.save(wallet);

      await queryRunner.manager.save(
        queryRunner.manager.create(WalletTransaction, {
          wallet,
          type: WalletTransactionType.DEBIT,
          amount_cents: debitAmount.toString(),
          balance_after_cents: nextBalance.toString(),
          reference_type: referenceType,
          reference_id: referenceId,
          description,
        }),
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async adminCreditWallet(
    userId: string,
    amountCents: number,
    description: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(WalletAccount, {
        where: { user: { id: userId } },
      });

      if (!wallet) throw new NotFoundException('Wallet not found');

      const currentBalance = BigInt(wallet.balance_cents);
      const creditAmount = BigInt(amountCents);
      const nextBalance = currentBalance + creditAmount;

      wallet.balance_cents = nextBalance.toString();
      await queryRunner.manager.save(wallet);

      await queryRunner.manager.save(
        queryRunner.manager.create(WalletTransaction, {
          wallet,
          type: WalletTransactionType.CREDIT,
          amount_cents: creditAmount.toString(),
          balance_after_cents: nextBalance.toString(),
          reference_type: 'admin_credit',
          reference_id: null,
          description,
        }),
      );

      await queryRunner.commitTransaction();
      await this.emitWalletCreditSideEffects({
        userId,
        amountCents,
        wallet,
        description,
        referenceType: 'admin_credit',
        referenceId: null,
      });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}