import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lead } from './lead.entity';
import { User } from './user.entity';

@Entity('lead_grade_overrides')
@Index(['lead', 'created_at'])
export class LeadGradeOverride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead!: Lead;

  @Column({ type: 'int' })
  original_score!: number;

  @Column({ type: 'int' })
  override_score!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer!: User | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}
