import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
  } from 'typeorm'
  
  import { User } from './user.entity'
  
  @Entity('audit_logs')
  
  export class AuditLog {
  
    @PrimaryGeneratedColumn('uuid')
    id!: string
  
    /*
    user who performed the action
    */
  
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'actor_id' })
    actor!: User | null
  
    /*
    action performed
    */
  
    @Column()
    action!: string
  
    /*
    target entity info
    */
  
    @Column()
    target_type!: string
  
    @Column()
    target_id!: string
  
    /*
    extra metadata
    */
  
    @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
    metadata!: Record<string, any>
  
    /*
    request info
    */
  
    @Column({type: 'varchar', nullable: true })
    ip_address!: string | null
  
    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at!: Date
  }