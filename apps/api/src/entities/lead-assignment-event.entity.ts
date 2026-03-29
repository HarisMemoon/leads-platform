import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LeadAssignment } from './lead-assignment.entity';

@Entity('lead_assignment_events')
export class LeadAssignmentEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => LeadAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment!: LeadAssignment;

  @Column()
  event_type!: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  body!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}
