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
  
  import { Lead } from './lead.entity'
  import { User } from './user.entity'
  import { WalletTransaction } from './wallet-transaction.entity'
  
  import { PurchaseType } from '../../common/enums/purchase-type.enum'
  import { GhlSyncStatus } from '../../common/enums/ghl-sync-status.enum'
  import { CrmSyncStatus } from '../../common/enums/crm-sync-status.enum'
  
  @Entity('lead_assignments')
  
  @Index(['buyer', 'created_at'])
  
  export class LeadAssignment {
  
    @PrimaryGeneratedColumn('uuid')
    id!: string
  
    @ManyToOne(() => Lead, (lead) => lead.assignments, {
      onDelete: 'CASCADE'
    })
    @JoinColumn({ name: 'lead_id' })
    lead!: Lead
  
    @ManyToOne(() => User)
    @JoinColumn({ name: 'buyer_id' })
    buyer!: User
  
    @Column({
      type: 'enum',
      enum: PurchaseType
    })
    purchase_type!: PurchaseType
  
    @Column({ type: 'bigint' })
    amount_charged_cents!: string
  
    @ManyToOne(() => WalletTransaction, { nullable: true })
    @JoinColumn({ name: 'wallet_transaction_id' })
    wallet_transaction!: WalletTransaction | null
  
    @Column({
      type: 'enum',
      enum: GhlSyncStatus,
      default: GhlSyncStatus.PENDING
    })
    ghl_sync_status!: GhlSyncStatus
  
    @Column({ default: false })
    twilio_contacted!: boolean
  
    @Column({
      type: 'enum',
      enum: CrmSyncStatus,
      default: CrmSyncStatus.PENDING
    })
    crm_sync_status!: CrmSyncStatus
  
    /** Number of CRM delivery retry attempts made so far (0 = not yet tried) */
    @Column({ type: 'int', default: 0 })
    crm_retry_count!: number

    /** Timestamp of the next scheduled CRM retry attempt (null = no retry pending) */
    @Column({ type: 'timestamp with time zone', nullable: true })
    crm_next_retry_at!: Date | null

    /** Last error message from a failed CRM delivery attempt */
    @Column({ type: 'text', nullable: true })
    crm_last_error!: string | null

    @Column({ type: 'varchar',nullable: true })
    disposition!: string | null

    @Column({ type: 'varchar', nullable: true })
    lifecycle_phase!: string | null

    @Column({ type: 'bigint', nullable: true })
    contract_price_cents!: string | null

    @Column({ type: 'bigint', nullable: true })
    sell_price_cents!: string | null

    @Column({ type: 'text', nullable: true })
    buyer_notes!: string | null

    /** 'exclusive' | 'non_exclusive' — which pricing path the buyer chose. */
    @Column({ type: 'varchar', nullable: true })
    exclusivity_choice!: string | null
  
    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at!: Date
  
    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at!: Date
  }