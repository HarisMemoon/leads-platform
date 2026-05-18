import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanType } from '../../common/enums/plan-type.enum';
import type { PlanFeatureBullet } from '../../common/subscription-plan-bullet.util';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryColumn({ type: 'enum', enum: PlanType })
  plan_type!: PlanType;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text' })
  tagline!: string;

  @Column({ type: 'bigint' })
  monthly_price_cents!: string;

  @Column({ type: 'varchar' })
  display_price!: string;

  @Column({ type: 'varchar', default: 'per month' })
  billing_period_label!: string;

  @Column({ type: 'int', nullable: true })
  monthly_lead_limit!: number | null;

  @Column({ type: 'varchar' })
  lead_limit_summary!: string;

  @Column({ type: 'int', default: 1 })
  priority_rank!: number;

  @Column({ type: 'varchar' })
  priority_label!: string;

  @Column({ type: 'text' })
  distribution_summary!: string;

  @Column({ type: 'text', nullable: true })
  included_lead_credits_summary!: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  filter_scope!: {
    state?: boolean;
    county?: boolean;
    zip?: boolean;
    leadType?: boolean;
  };

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  card_highlights!: string[];

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  feature_bullets!: PlanFeatureBullet[];

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
