import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
  } from 'typeorm'
  
  import { User } from './user.entity'
  
  @Entity('distribution_rules')
  
  @Index(['user', 'market', 'is_active'])
  
  export class DistributionRule {
  
    @PrimaryGeneratedColumn('uuid')
    id!: string
  
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User

  @Column({ default: false })
  participation_enabled!: boolean

  @Column({ type: 'int', default: 5 })
  max_per_day!: number
  
    @Column()
    market!: string

  @Column({
    type: 'text',
    array: true,
    default: () => 'ARRAY[]::text[]'
  })
  market_filters!: string[]
  
    @Column({ default: true })
    is_active!: boolean
  
    /*
    Lead caps
    */
  
    @Column({ type: 'int', nullable: true })
    max_leads_per_day!: number | null
  
    @Column({ type: 'int', nullable: true })
    max_leads_per_week!: number | null
  
    @Column({ type: 'int', nullable: true })
    max_leads_per_month!: number | null
  
    /*
    Spend caps
    */
  
    @Column({ type: 'bigint', nullable: true })
    max_spend_per_day_cents!: string | null
  
    @Column({ type: 'bigint', nullable: true })
    max_spend_per_week_cents!: string | null
  
    @Column({ type: 'bigint', nullable: true })
    max_spend_per_month_cents!: string | null
  
    /*
    Wallet protection
    */
  
    @Column({ type: 'bigint', default: 0 })
    min_wallet_balance_cents!: string
  
    /*
    Filtering
    */
  
    @Column({
      type: 'text',
      array: true,
      default: () => 'ARRAY[]::text[]'
    })
    lead_type_filters!: string[]

  @Column({ type: 'int', default: 0 })
  cooldown_minutes!: number
  
    /*
    Rotation algorithm support
    */
  
    @Column({ type: 'int', default: 0 })
    rotation_position!: number

    // ── Marketplace-v2 fields (Phase A) ──────────────────────────────────────

    /**
     * Which exclusivity type this rule targets for auto-distribution.
     * Values: 'exclusive_only' | 'non_exclusive_only' | 'both'
     */
    @Column({ type: 'varchar', default: 'both' })
    exclusivity_preference!: string

    /** Maximum per-lead price (cents) this rule will auto-buy. NULL = no ceiling. */
    @Column({ type: 'bigint', nullable: true })
    max_lead_price_cents!: string | null

    // ─────────────────────────────────────────────────────────────────────────

    /*
    timestamps
    */
  
    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at!: Date
  
    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at!: Date
  }