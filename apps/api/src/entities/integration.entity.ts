import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
  } from 'typeorm'
  
  import { User } from './user.entity'
  import { IntegrationProvider } from '../../common/enums/integration-provider.enum'
  import { IntegrationStatus } from '../../common/enums/integration-status.enum'    
  
  @Entity('integrations')
  
  export class Integration {
  
    @PrimaryGeneratedColumn('uuid')
    id!: string
  
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User
  
    @Column({
      type: 'enum',
      enum: IntegrationProvider
    })
    provider!: IntegrationProvider
  
    @Column({
      type: 'enum',
      enum: IntegrationStatus
    })
    status!: IntegrationStatus
  
    /*
    provider config (API keys, account ids etc)
    */
  
    @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
    config!: Record<string, any>
  
    /*
    last sync
    */
  
    @Column({ type: 'timestamp with time zone', nullable: true })
    last_sync_at!: Date | null
  
    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at!: Date
  
    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at!: Date
  }