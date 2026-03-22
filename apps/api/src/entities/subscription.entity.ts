import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
  } from 'typeorm'
  
  import { User } from './user.entity'
  import { PlanType } from '../../common/enums/plan-type.enum'
  import { SubscriptionStatus } from '../../common/enums/subscription-status.enum'
  
  @Entity('subscriptions')
  
  export class Subscription {
  
    @PrimaryGeneratedColumn('uuid')
    id!: string
  
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User
  
    @Column({
      type: 'enum',
      enum: PlanType
    })
    plan_type!: PlanType
  
    @Column({ type: 'varchar', unique: true })
    stripe_subscription_id!: string
  
    @Column({ type: 'varchar' })
    stripe_price_id!: string
  
    @Column({
      type: 'enum',
      enum: SubscriptionStatus
    })
    status!: SubscriptionStatus
  
    /*
    Distribution priority
    */
  
    @Column({ type: 'int', default: 1 })
    priority_weight!: number
  
    /*
    Billing cycle
    */
  
    @Column({ type: 'timestamp with time zone' })
    current_period_start!: Date
  
    @Column({ type: 'timestamp with time zone' })
    current_period_end!: Date
  
    /*
    Lead limits
    */
  
    @Column({ type: 'int', nullable: true })
    monthly_lead_limit!: number | null
  
    @Column({ type: 'int', default: 0 })
    leads_used_this_period!: number
  
    /*
    Markets enabled for this subscription
    */
  
    @Column({
      type: 'text',
      array: true,
      default: () => 'ARRAY[]::text[]'
    })
    markets!: string[]
  
    /*
    timestamps
    */
  
    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at!: Date
  
    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at!: Date
  }