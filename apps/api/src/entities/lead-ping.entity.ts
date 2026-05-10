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

import { BuyerPricingRule } from './buyer-pricing-rule.entity';
import { User } from './user.entity';
import { VendorIntegration } from './vendor-integration.entity';

@Entity('lead_pings')
@Index(['vendor', 'vendor_ping_id'], { unique: true })
@Index(['status', 'expires_at'])
@Index(['state', 'city', 'zip'])
@Index(['matched_buyer', 'created_at'])
export class LeadPing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => VendorIntegration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor!: VendorIntegration;

  @Column({ type: 'varchar' })
  vendor_ping_id!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: 'pending' | 'accepted' | 'rejected' | 'posted' | 'expired';

  @Column({ type: 'varchar', nullable: true })
  market!: string | null;

  @Column({ type: 'varchar', nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', nullable: true })
  zip!: string | null;

  @Column({ type: 'varchar', nullable: true })
  county!: string | null;

  @Column({ type: 'varchar', nullable: true })
  property_type!: string | null;

  @Column({ type: 'varchar' })
  lead_type!: string;

  @Column({ type: 'varchar', nullable: true })
  source!: string | null;

  @Column({ type: 'varchar', default: 'exclusive' })
  exclusivity_choice!: 'exclusive' | 'non_exclusive';

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'matched_buyer_id' })
  matched_buyer!: User | null;

  @ManyToOne(() => BuyerPricingRule, { nullable: true })
  @JoinColumn({ name: 'matched_pricing_rule_id' })
  matched_pricing_rule!: BuyerPricingRule | null;

  @Column({ type: 'bigint', nullable: true })
  matched_price_cents!: string | null;

  @Column({ type: 'varchar', nullable: true })
  rejection_reason!: string | null;

  @Column({ type: 'int', nullable: true })
  latency_ms!: number | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expires_at!: Date | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  payload!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
