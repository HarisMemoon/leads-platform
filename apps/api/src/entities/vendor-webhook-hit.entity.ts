import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VendorIntegration } from './vendor-integration.entity';
import { Lead } from './lead.entity';

@Entity('vendor_webhook_hits')
@Index(['vendor', 'created_at'])
export class VendorWebhookHit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => VendorIntegration, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vendor_id' })
  vendor!: VendorIntegration | null;

  @Column({ name: 'vendor_id', type: 'uuid', nullable: true })
  vendor_id!: string | null;

  @ManyToOne(() => Lead, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lead_id' })
  lead!: Lead | null;

  @Column({ name: 'lead_id', type: 'uuid', nullable: true })
  lead_id!: string | null;

  /** 'accepted' | 'rejected' */
  @Column({ type: 'varchar', default: 'accepted' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  rejection_reason!: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip_address!: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  payload_snapshot!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}
