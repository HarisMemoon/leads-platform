import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
  } from 'typeorm'
  
  import { Lead } from './lead.entity'
  
  @Entity('lead_price_history')
  
  export class LeadPriceHistory {
  
    @PrimaryGeneratedColumn('uuid')
    id!: string
  
    @ManyToOne(() => Lead, (lead) => lead.priceHistory, {
      onDelete: 'CASCADE'
    })
    @JoinColumn({ name: 'lead_id' })
    lead!: Lead
  
    @Column({ type: 'bigint' })
    old_price_cents!: string
  
    @Column({ type: 'bigint' })
    new_price_cents!: string
  
    @Column()
    reason!: string
  
    @CreateDateColumn({ type: 'timestamp with time zone' })
    changed_at!: Date
  }