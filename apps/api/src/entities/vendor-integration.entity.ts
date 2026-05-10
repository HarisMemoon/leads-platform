import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vendor_integrations')
@Index(['enabled'])
export class VendorIntegration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  api_key_hash!: string;

  @Column({ default: true })
  enabled!: boolean;

  @Column({
    type: 'text',
    array: true,
    default: () => 'ARRAY[]::text[]',
  })
  allowed_sources!: string[];

  @Column({ type: 'int', default: 750 })
  ping_timeout_ms!: number;

  @Column({ type: 'int', default: 900 })
  ping_ttl_seconds!: number;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
