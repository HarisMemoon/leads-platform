import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WalletAccount } from '../entities/wallet-account.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { WalletTransactionType } from '../../common/enums/wallet-transaction-type.enum';

@Injectable()
export class WalletService {

  constructor(
    @InjectRepository(WalletAccount)
    private walletRepo: Repository<WalletAccount>,

    @InjectRepository(WalletTransaction)
    private txRepo: Repository<WalletTransaction>,

    private dataSource: DataSource
  ) {}

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
   */
  async topup(
    userId: string,
    amountCents: number,
    description?: string,
    referenceType = 'dev_topup',
  ) {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(WalletAccount, {
        where: { user: { id: userId } },
      });

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
        reference_id: null,
        description: description || 'Wallet credit',
      });

      await manager.save(tx);

      return wallet;
    });
  }

  /*
  TRANSACTIONS LIST
  */
  async getTransactions(userId: string, limit = 50, offset = 0) {

    const wallet = await this.walletRepo.findOne({
      where: { user: { id: userId } }
    });

    if (!wallet) throw new NotFoundException('Wallet not found');

    return this.txRepo.find({
      where: { wallet: { id: wallet.id } },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset
    });
  }
}