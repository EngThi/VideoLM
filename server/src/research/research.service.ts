import { Injectable, Logger } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(private projectsService: ProjectsService) {}

  async addSources(projectId: string, urls: string[]) {
    this.logger.log(`Adding ${urls.length} sources to project ${projectId}`);
    return this.projectsService.updateMetadata(projectId, { sources: urls });
  }

  async startNotebookLMResearch(projectId: string) {
    // Aqui entrará a integração com o tmc/nlm
    await this.projectsService.updateStatus(projectId, 'researching');
    this.logger.log(`Started NotebookLM deep dive for project ${projectId}`);
    
    // TODO: Trigger nlm CLI or NotebookLM Internal API
    return { status: 'queued', message: 'Research in progress via NotebookLM' };
  }
}
