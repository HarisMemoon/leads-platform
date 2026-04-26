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
import { User } from './user.entity';

export type IngestionBatchStatus =
  | 'pending'
  | 'processing'
  | 'processed'
  | 'failed';

@Entity('lead_ingestion_batches')
@Index(['status', 'created_at'])
export class LeadIngestionBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  filename!: string;

  @Column({ type: 'varchar', nullable: true })
  vendor!: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: IngestionBatchStatus;

  @Column({ type: 'int', default: 0 })
  total_rows!: number;

  @Column({ type: 'int', default: 0 })
  processed_rows!: number;

  @Column({ type: 'int', default: 0 })
  failed_rows!: number;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploaded_by!: User | null;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  failure_samples!: Array<{ row: number; reason: string }>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  processed_at!: Date | null;
}
