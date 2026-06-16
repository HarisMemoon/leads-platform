import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('terms_acceptances')
export class TermsAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  /** Version string of the terms accepted, e.g. "2025-01" */
  @Column({ type: 'varchar', length: 32, default: '2025-01' })
  terms_version!: string;

  @Column({ type: 'varchar', nullable: true })
  ip_address!: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  accepted_at!: Date;
}
