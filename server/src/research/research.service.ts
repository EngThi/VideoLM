import { Injectable, Logger } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { NotebookLMEngine } from './notebook-lm.engine';

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(
    private projectsService: ProjectsService,
    private notebookLM: NotebookLMEngine,
  ) {}

  async addSources(projectId: string, urls: string[]) {
    this.logger.log(`Adding ${urls.length} sources to project ${projectId}`);
    return this.projectsService.updateMetadata(projectId, { sources: urls });
  }

  async startNotebookLMResearch(projectId: string, type: 'audio' | 'video' = 'audio') {
    await this.projectsService.updateStatus(projectId, 'researching');
    
    // TODO: Recuperar o notebookId real do metadado do projeto
    const notebookId = 'placeholder-id'; 

    if (type === 'video') {
      return this.notebookLM.createVideoOverview(notebookId);
    }
    return this.notebookLM.createAudioOverview(notebookId);
  }
}
