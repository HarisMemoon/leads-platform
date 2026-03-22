import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
  } from 'typeorm'
  
  import { User } from './user.entity'
  import { NotificationChannel } from '../../common/enums/notification-channel.enum'
  
  @Entity('notification_logs')
  
  @Index(['user', 'is_read', 'sent_at'])
  
  export class NotificationLog {
  
    @PrimaryGeneratedColumn('uuid')
    id!: string
  
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User
  
    @Column()
    type!: string
  
    @Column()
    title!: string
  
    @Column({ type: 'text' })
    body!: string
  
    @Column({
      type: 'enum',
      enum: NotificationChannel
    })
    channel!: NotificationChannel
  
    @Column({ default: false })
    is_read!: boolean
  
    /*
    Reference to object that triggered notification
    */
  
    @Column({ type: 'varchar', nullable: true })
    reference_type!: string | null
  
    @Column({ type: 'varchar', nullable: true })
    reference_id!: string | null
  
    /*
    Send timestamp
    */
  
    @CreateDateColumn({ type: 'timestamp with time zone' })
    sent_at!: Date
  }