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

  @Column()
  password_hash!: string;

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

