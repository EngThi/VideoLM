
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

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

  async findAll(userId?: string): Promise<ProjectEntity[]> {
    if (userId) {
      return this.projectRepo.find({ 
        where: { user: { id: userId } },
        order: { createdAt: 'DESC' } 
      });
    }
    return this.projectRepo.find({ order: { createdAt: 'DESC' } });
  }

  async updateStatus(
    id: string,
    status: string,
    videoPath?: string,
    error?: string,
  ): Promise<ProjectEntity> {
    let project = await this.projectRepo.findOne({ where: { id } });
    
    if (!project) {
      this.logger.log(`Project ${id} not found. Auto-creating during status update.`);
      project = this.projectRepo.create({
        id,
        title: 'Auto-created project',
        topic: 'VideoLM render job',
        status: status as any,
      });
    } else {
      project.status = status as any;
    }

    if (videoPath) project.videoPath = videoPath;
    if (error) project.error = error;
    
    return this.projectRepo.save(project);
  }

  async updateMetadata(id: string, metadata: any): Promise<ProjectEntity> {
    let project = await this.projectRepo.findOne({ where: { id } });
    
    if (!project) {
      this.logger.log(`Project ${id} not found. Auto-creating during metadata update.`);
      project = this.projectRepo.create({
        id,
        title: 'Auto-created project',
        topic: 'VideoLM research job',
        status: 'idle',
        metadata
      });
    } else {
      project.metadata = { ...project.metadata, ...metadata };
    }
    
    return this.projectRepo.save(project);
  }

  async updateSources(id: string, sources: string[]): Promise<ProjectEntity> {
    const project = await this.findOne(id);
    project.sources = sources;
    return this.projectRepo.save(project);
  }

  async update(id: string, partial: Partial<ProjectEntity>): Promise<ProjectEntity> {
    const project = await this.findOne(id);
    Object.assign(project, partial);
    return this.projectRepo.save(project);
  }

  async delete(id: string): Promise<void> {
    const result = await this.projectRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Project ${id} not found`);
    }
  }
}
