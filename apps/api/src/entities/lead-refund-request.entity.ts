import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RefundRequestStatus } from '../../common/enums/refund-request-status.enum';
import { LeadAssignment } from './lead-assignment.entity';
import { User } from './user.entity';

@Entity('lead_refund_requests')
export class LeadRefundRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => LeadAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_assignment_id' })
  lead_assignment!: LeadAssignment;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyer_id' })
  buyer!: User;

  @Column({ type: 'varchar', length: 32, default: RefundRequestStatus.PENDING })
  status!: RefundRequestStatus;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'text', nullable: true })
  admin_notes!: string | null;

  /** wallet_credit | premium_credit — set when approved */
  @Column({ type: 'varchar', nullable: true })
  resolution!: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
