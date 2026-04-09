
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { UserEntity } from '../users/user.entity';

@Entity('projects')
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  topic: string;

  @Column('text', { nullable: true })
  script: string;

  @Column({ nullable: true })
  theme: string;

  @Column('text', { nullable: true })
  videoPath: string;

  @Column({ default: 'idle' })
  status: 'idle' | 'processing' | 'done' | 'error' | 'completed';

  @Column('text', { nullable: true })
  error: string;

  @Column('simple-json', { nullable: true })
  metadata: any;

  @ManyToOne(() => UserEntity, (user) => user.projects, { nullable: true })
  user: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
