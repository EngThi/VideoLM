import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { NotebookLMEngine } from './notebook-lm.engine';

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(
    private projectsService: ProjectsService,
    private notebookLM: NotebookLMEngine,
  ) {}

  /**
   * Adiciona URLs ao projeto e persiste na coluna 'sources'
   */
  async addSources(projectId: string, urls: string[]) {
    this.logger.log(`Adding ${urls.length} sources to project ${projectId}`);
    
    // Atualiza a coluna de fontes e os metadados simultaneamente
    await this.projectsService.updateMetadata(projectId, { 
      lastSourceUpdate: new Date().toISOString(),
      sourceCount: urls.length 
    });

    // Salva as fontes na coluna dedicada da entidade
    const project = await this.projectsService.findOne(projectId);
    project.sources = urls;
    
    // Usamos o repositório indiretamente via ProjectsService se possível, 
    // mas aqui o Júnior esperto sabe que precisa garantir a persistência.
    return this.projectsService.updateStatus(projectId, project.status); 
  }

  /**
   * Orquestra a criação do notebook e o disparo da geração de conteúdo
   */
  async startNotebookLMResearch(projectId: string, type: 'audio' | 'video' = 'audio') {
    const project = await this.projectsService.findOne(projectId);
    
    if (!project.sources || project.sources.length === 0) {
      throw new NotFoundException('No sources found for this project. Add URLs first.');
    }

    await this.projectsService.updateStatus(projectId, 'researching');
    
    let notebookId = project.metadata?.notebookId;

    try {
      // 1. Criar o Notebook se não existir
      if (!notebookId || notebookId === 'placeholder-id' || notebookId.startsWith('notebook_')) {
        this.logger.log(`Creating new Google Notebook for project ${projectId}...`);
        notebookId = await this.notebookLM.createNotebook(`Factory: ${project.title || project.id}`);
        await this.projectsService.updateMetadata(projectId, { notebookId });
      }

      // 2. Injetar as fontes no Notebook criado
      this.logger.log(`Feeding ${project.sources.length} sources into notebook ${notebookId}...`);
      for (const source of project.sources) {
        try {
          await this.notebookLM.addSource(notebookId, source);
        } catch (sourceErr) {
          this.logger.warn(`Failed to add source ${source}, skipping: ${sourceErr.message}`);
        }
      }

      // 3. Disparar a geração (Deep Dive)
      this.logger.log(`Triggering ${type} overview for notebook ${notebookId}`);
      
      if (type === 'video') {
        return this.notebookLM.createVideoOverview(notebookId);
      }
      return this.notebookLM.createAudioOverview(notebookId);

    } catch (error) {
      this.logger.error(`Failed to execute NotebookLM pipeline: ${error.message}`);
      await this.projectsService.updateStatus(projectId, 'error', undefined, `Research failed: ${error.message}`);
      throw error;
    }
  }
}
