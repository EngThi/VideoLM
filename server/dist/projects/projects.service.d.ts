import { Repository } from 'typeorm';
import { ProjectEntity } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
export declare class ProjectsService {
    private projectRepo;
    constructor(projectRepo: Repository<ProjectEntity>);
    create(createProjectDto: CreateProjectDto): Promise<ProjectEntity>;
    findOne(id: string): Promise<ProjectEntity>;
    findAll(): Promise<ProjectEntity[]>;
    updateStatus(id: string, status: string, videoPath?: string, error?: string): Promise<ProjectEntity>;
    delete(id: string): Promise<void>;
}
