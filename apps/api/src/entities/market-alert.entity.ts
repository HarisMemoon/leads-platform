import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
  } from 'typeorm'
  
  import { User } from './user.entity'
  
  @Entity('market_alerts')
  
  @Index(['market', 'is_active'])
  
  export class MarketAlert {
  
    @PrimaryGeneratedColumn('uuid')
    id!: string
  
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User
  
    @Column()
    market!: string
  
    /*
    Lead filters
    */
  
    @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
    filters!: Record<string, any>
  
    /*
    Delivery channels
    */
  
    @Column({
      type: 'text',
      array: true,
      default: () => "ARRAY['email']::text[]"
    })
    delivery_channels!: string[]
  
    /*
    Frequency
    */
  
    @Column()
    frequency!: 'instant' | 'hourly' | 'daily' | 'weekly'
  
    /*
    Do not disturb window
    */
  
    @Column({ type: 'time', nullable: true })
    dnd_start!: string | null
  
    @Column({ type: 'time', nullable: true })
    dnd_end!: string | null
  
    /*
    Throttling
    */
  
    @Column({ type: 'int', nullable: true })
    max_per_day!: number | null
  
    @Column({ default: true })
    is_active!: boolean
  
    /*
    timestamps
    */
  
    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at!: Date
  
    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at!: Date
  }