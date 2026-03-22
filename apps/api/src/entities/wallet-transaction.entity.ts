import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WalletTransactionType } from '../../common/enums/wallet-transaction-type.enum';
import { WalletAccount } from './wallet-account.entity';

@Entity('wallet_transactions')
@Index(['wallet', 'created_at'])
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => WalletAccount, (wallet) => wallet.transactions, {
    onDelete: 'CASCADE',
  })
  wallet!: WalletAccount;

  @Column({
    type: 'enum',
    enum: WalletTransactionType,
  })
  type!: WalletTransactionType;

  @Column({ type: 'bigint' })
  amount_cents!: string;

  @Column({ type: 'bigint' })
  balance_after_cents!: string;

  @Column()
  reference_type!: string;

  @Column({ type: 'varchar', nullable: true })
  reference_id!: string | null;

  @Column({ type: 'varchar' })
  description!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}

