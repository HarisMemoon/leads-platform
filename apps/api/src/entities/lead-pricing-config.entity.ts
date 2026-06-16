import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lead_pricing_config')
export class LeadPricingConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 'inbound' | 'outbound' — unique per type */
  @Column({ unique: true })
  lead_type!: string;

  /** Full price for a brand-new lead (cents). e.g. 15000 = $150 */
  @Column({ type: 'bigint' })
  new_lead_price_cents!: string;

  /** Flat price for Pro subscribers buying shared slots (cents). e.g. 2500 = $25 */
  @Column({ type: 'bigint', nullable: true })
  shared_price_cents!: string | null;

  /** Days before automatic price markdown kicks in. e.g. 7 */
  @Column({ type: 'int', default: 7 })
  discount_after_days!: number;

  /** Amount subtracted from price after discount_after_days (cents). e.g. 12500 = $125 off */
  @Column({ type: 'bigint', default: '0' })
  discount_amount_cents!: string;

  /** Price cannot fall below this value after discounts (cents). e.g. 2000 = $20 floor */
  @Column({ type: 'bigint', nullable: true })
  min_price_floor_cents!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
