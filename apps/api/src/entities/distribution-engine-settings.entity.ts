import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('distribution_engine_settings')
export class DistributionEngineSettings {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ default: false })
  queue_paused!: boolean;

  @Column({ type: 'int', default: 10 })
  max_auto_distribution_runs!: number;

  @Column({ type: 'int', default: 15 })
  cooldown_minutes_between_runs!: number;

  @Column({ type: 'int', default: 7 })
  markdown_after_days!: number;

  @Column({ type: 'int', default: 10 })
  markdown_percent!: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
