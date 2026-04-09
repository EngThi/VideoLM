import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ProjectEntity } from '../projects/project.entity';

@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password?: string;

  @Column({ default: 10 }) // Free tier: 10 videos/month
  quota: number;

  @Column({ default: 0 })
  videosGenerated: number;

  @OneToMany(() => ProjectEntity, (project) => project.user)
  projects: ProjectEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
