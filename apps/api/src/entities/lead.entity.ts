import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm'
  
  import { User } from './user.entity'
  import { LeadStatus } from '../../common/enums/lead-status.enum'
  import { ExclusivityLevel } from '../../common/enums/exclusivity-level.enum'
  import { LeadPriceHistory } from './lead-price-history.entity'
  import { LeadAssignment } from './lead-assignment.entity'
  
  @Entity('leads')
  
  @Index(['market', 'status', 'created_at'])
  @Index(['status', 'exclusivity_level', 'price_cents'])
  @Index(['reserved_by_user', 'reserved_until'])
  
  export class Lead {
  
    @PrimaryGeneratedColumn('uuid')
    id!: string
  
    @Column({ type: 'varchar', nullable: true })
    external_id!: string | null
  
    @Column()
    source!: string
  
    @Column()
    market!: string
  
    @Column()
    lead_type!: string
  
    @Column({
      type: 'enum',
      enum: LeadStatus
    })
    status!: LeadStatus
  
    @Column({
      type: 'enum',
      enum: ExclusivityLevel
    })
    exclusivity_level!: ExclusivityLevel
  
    @Column({ type: 'int' })
    quality_score!: number
  
    @Column({ type: 'bigint' })
    price_cents!: string

    /** Display anchor for markdown ("was" price); set on create / first markdown. */
    @Column({ type: 'bigint', nullable: true })
    list_price_anchor_cents!: string | null

    /** premium | standard | value — derived from quality, exclusivity, age. */
    @Column({ type: 'varchar', nullable: true })
    marketplace_tier!: string | null

    @Column({ type: 'int', default: 0 })
    distribution_run_count!: number

    @Column({ type: 'timestamp with time zone', nullable: true })
    last_distribution_at!: Date | null
  
    @Column()
    title!: string
  
    @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
    metadata!: Record<string, any>

    @Column({ type: 'varchar', nullable: true })
    canonical_lead_source!: string | null

    @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
    utm!: Record<string, string>

    @ManyToOne(() => Lead, { nullable: true })
    @JoinColumn({ name: 'duplicate_of_lead_id' })
    duplicate_of_lead!: Lead | null
  
    /*
    Reservation system
    */
  
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'reserved_by_user_id' })
    reserved_by_user!: User | null
  
    @Column({ type: 'timestamp with time zone', nullable: true })
    reserved_until!: Date | null
  
    @Column({ type: 'timestamp with time zone', nullable: true })
    acquired_at!: Date | null
  
    /*
    Relations
    */
  
    @OneToMany(
      () => LeadPriceHistory,
      (priceHistory) => priceHistory.lead
    )
    priceHistory!: LeadPriceHistory[]
  
    @OneToMany(
      () => LeadAssignment,
      (assignment) => assignment.lead
    )
    assignments!: LeadAssignment[]
  
    /*
    timestamps
    */
  
    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at!: Date
  
    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at!: Date
  }