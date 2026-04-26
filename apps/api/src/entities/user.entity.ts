import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  /** Null for Google-only accounts */
  @Column({ type: 'varchar', nullable: true })
  password_hash!: string | null;

  @Column({ type: 'varchar', nullable: true, unique: true })
  google_sub!: string | null;

  @Column({ default: false })
  distribution_locked!: boolean;

  @Column({ type: 'varchar', nullable: true })
  utm_source!: string | null;

  @Column({ type: 'varchar', nullable: true })
  utm_medium!: string | null;

  @Column({ type: 'varchar', nullable: true })
  utm_campaign!: string | null;

  @Column({ type: 'varchar', nullable: true })
  utm_content!: string | null;

  @Column({ type: 'varchar', nullable: true })
  utm_term!: string | null;

  @Column({type: 'varchar', nullable: true })
  full_name!: string | null;

  @Column({type: 'varchar', nullable: true })
  company_name!: string | null;

  @Column({type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role!: UserRole;

  @Column({type: 'varchar', nullable: true })
  stripe_customer_id!: string | null;

  @Column({ default: false })
  email_verified!: boolean;

  @Column({ default: false })
  onboarding_completed!: boolean;

  @Column({ default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

