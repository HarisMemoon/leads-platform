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
  
    @Column()
    market!: string
  
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
  
    /*
    Rotation algorithm support
    */
  
    @Column({ type: 'int', default: 0 })
    rotation_position!: number
  
    /*
    timestamps
    */
  
    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at!: Date
  
    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at!: Date
  }