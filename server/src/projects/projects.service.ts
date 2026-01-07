
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity)
    private projectRepo: Repository<ProjectEntity>,
  ) {}

  async create(createProjectDto: CreateProjectDto): Promise<ProjectEntity> {
    const project = this.projectRepo.create({
      title: createProjectDto.title,
      topic: createProjectDto.topic,
      status: 'idle',
    });
    return this.projectRepo.save(project);
  }

  async findOne(id: string): Promise<ProjectEntity> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async findAll(): Promise<ProjectEntity[]> {
    return this.projectRepo.find({ order: { createdAt: 'DESC' } });
  }

  async updateStatus(
    id: string,
    status: string,
    videoPath?: string,
    error?: string,
  ): Promise<ProjectEntity> {
    const project = await this.findOne(id);
    project.status = status as any;
    if (videoPath) project.videoPath = videoPath;
    if (error) project.error = error;
    return this.projectRepo.save(project);
  }

  async delete(id: string): Promise<void> {
    const result = await this.projectRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Project ${id} not found`);
    }
  }
}
