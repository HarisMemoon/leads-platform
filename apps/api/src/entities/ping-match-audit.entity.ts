import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BuyerPricingRule } from './buyer-pricing-rule.entity';
import { LeadPing } from './lead-ping.entity';
import { User } from './user.entity';

@Entity('ping_match_audit')
@Index(['ping', 'eligible'])
@Index(['buyer', 'created_at'])
export class PingMatchAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => LeadPing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ping_id' })
  ping!: LeadPing;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'buyer_id' })
  buyer!: User | null;

  @ManyToOne(() => BuyerPricingRule, { nullable: true })
  @JoinColumn({ name: 'pricing_rule_id' })
  pricing_rule!: BuyerPricingRule | null;

  @Column({ default: false })
  eligible!: boolean;

  @Column({ type: 'bigint', nullable: true })
  price_cents!: string | null;

  @Column({ type: 'int', default: 0 })
  ranking_score!: number;

  @Column({ type: 'varchar', nullable: true })
  rejection_reason!: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  details!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}
