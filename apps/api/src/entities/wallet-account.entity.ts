import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from './user.entity';
import { WalletTransaction } from './wallet-transaction.entity';

@Entity('wallet_accounts')
export class WalletAccount {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /*
  One wallet per user
  */
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  /*
  Stored in cents
  NEVER floats
  */
  @Column({ type: 'bigint', default: 0 })
  balance_cents!: string;

  @Column({ default: 'usd' })
  currency!: string;

  /*
  Auto reload config
  */

  @Column({ default: false })
  auto_reload_enabled!: boolean;

  @Column({ type: 'bigint', nullable: true })
  auto_reload_threshold_cents!: string | null;

  @Column({ type: 'bigint', nullable: true })
  auto_reload_amount_cents!: string | null;

  @Column({type: 'varchar', nullable: true })
  stripe_payment_method_id!: string | null;

  /*
  Relations
  */

  @OneToMany(
    () => WalletTransaction,
    (transaction) => transaction.wallet
  )
  transactions!: WalletTransaction[];

  /*
  Timestamps
  */

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}