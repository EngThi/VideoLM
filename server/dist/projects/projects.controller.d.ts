import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
export declare class ProjectsController {
    private projectsService;
    constructor(projectsService: ProjectsService);
    create(createProjectDto: CreateProjectDto): Promise<import("./project.entity").ProjectEntity>;
    findAll(): Promise<import("./project.entity").ProjectEntity[]>;
    findOne(id: string): Promise<import("./project.entity").ProjectEntity>;
    delete(id: string): Promise<void>;
}
