import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('outbound_buyer_endpoints')
export class OutboundBuyerEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text' })
  ping_url!: string;

  @Column({ type: 'text', nullable: true })
  post_url!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  auth_header_name!: string | null;

  @Column({ type: 'text', nullable: true })
  auth_header_value!: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  field_map!: Record<string, string>;

  @Column({ type: 'bigint', default: '0' })
  price_floor_cents!: string;

  @Column({ type: 'int', default: 3000 })
  timeout_ms!: number;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
