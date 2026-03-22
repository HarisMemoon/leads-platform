import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('onboarding_progress')
export class OnboardingProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'int', default: 1 })
  current_step!: number;

  @Column({ type: 'int', array: true, default: () => 'ARRAY[]::integer[]' })
  completed_steps!: number[];

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  data!: Record<string, any>;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}

