import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ResourcesContentKind } from '../../common/enums/resources-content-kind.enum';

@Entity('resources_content')
export class ResourcesContent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  kind!: ResourcesContentKind;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'varchar', nullable: true })
  url!: string | null;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ default: true })
  is_published!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
