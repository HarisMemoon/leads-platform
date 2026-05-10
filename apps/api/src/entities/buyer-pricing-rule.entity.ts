import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from './user.entity';

@Entity('buyer_pricing_rules')
@Index(['user', 'is_active', 'paused'])
@Index(['is_active', 'priority'])
export class BuyerPricingRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ default: true })
  is_active!: boolean;

  @Column({ default: false })
  paused!: boolean;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  @Column({
    type: 'text',
    array: true,
    default: () => 'ARRAY[]::text[]',
  })
  markets!: string[];

  @Column({
    type: 'text',
    array: true,
    default: () => 'ARRAY[]::text[]',
  })
  states!: string[];

  @Column({
    type: 'text',
    array: true,
    default: () => 'ARRAY[]::text[]',
  })
  cities!: string[];

  @Column({
    type: 'text',
    array: true,
    default: () => 'ARRAY[]::text[]',
  })
  zips!: string[];

  @Column({
    type: 'text',
    array: true,
    default: () => 'ARRAY[]::text[]',
  })
  counties!: string[];

  @Column({
    type: 'text',
    array: true,
    default: () => 'ARRAY[]::text[]',
  })
  property_types!: string[];

  @Column({
    type: 'text',
    array: true,
    default: () => 'ARRAY[]::text[]',
  })
  lead_types!: string[];

  @Column({ type: 'bigint', nullable: true })
  fixed_price_cents!: string | null;

  @Column({ type: 'bigint', nullable: true })
  max_bid_cents!: string | null;

  @Column({ type: 'varchar', default: 'both' })
  exclusivity_preference!: 'exclusive_only' | 'non_exclusive_only' | 'both';

  @Column({ type: 'varchar', default: 'highest_bid' })
  routing_strategy!: 'highest_bid' | 'priority' | 'round_robin';

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
