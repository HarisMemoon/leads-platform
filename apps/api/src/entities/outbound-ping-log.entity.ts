import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type OutboundPingStatus =
  | 'accepted'
  | 'declined'
  | 'timeout'
  | 'error'
  | 'below_floor'
  | 'posted';

@Entity('outbound_ping_logs')
export class OutboundPingLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  lead_id!: string | null;

  @Column({ type: 'uuid' })
  buyer_endpoint_id!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: OutboundPingStatus;

  @Column({ type: 'bigint', nullable: true })
  bid_price_cents!: string | null;

  @Column({ type: 'bigint', default: '0' })
  floor_price_cents!: string;

  @Column({ type: 'jsonb', nullable: true })
  response_payload!: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  latency_ms!: number | null;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @Column({ type: 'boolean', default: false })
  is_test!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
