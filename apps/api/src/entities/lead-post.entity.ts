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

import { Lead } from './lead.entity';
import { LeadPing } from './lead-ping.entity';
import { VendorIntegration } from './vendor-integration.entity';

@Entity('lead_posts')
@Index(['vendor', 'vendor_lead_id'], { unique: true })
@Index(['ping'])
@Index(['status', 'created_at'])
export class LeadPost {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => VendorIntegration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor!: VendorIntegration;

  @ManyToOne(() => LeadPing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ping_id' })
  ping!: LeadPing;

  @Column({ type: 'varchar' })
  vendor_lead_id!: string;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'lead_id' })
  lead!: Lead | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: 'pending' | 'accepted' | 'rejected' | 'failed';

  @Column({ type: 'varchar', nullable: true })
  delivery_status!: string | null;

  @Column({ type: 'varchar', nullable: true })
  error_message!: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  payload!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
