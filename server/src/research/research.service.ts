
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { NotebookLMEngine } from './notebook-lm.engine';
import * as path from 'path';
import * as fs from 'fs';

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
    
    // 1. Atualiza metadados
    await this.projectsService.updateMetadata(projectId, { 
      lastSourceUpdate: new Date().toISOString(),
      sourceCount: urls.length 
    });

    // 2. Persiste as fontes de forma robusta
    return this.projectsService.updateSources(projectId, urls);
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

  /**
   * Verifica o status e baixa o resultado da pesquisa (Áudio ou Vídeo)
   */
  async downloadResearchResult(projectId: string) {
    const project = await this.projectsService.findOne(projectId);
    const notebookId = project.metadata?.notebookId;

    if (!notebookId) throw new NotFoundException('Notebook ID not found for this project.');

    try {
      const statusRaw = await this.notebookLM.checkStatus(notebookId);
      const artifacts = JSON.parse(statusRaw);
      const latest = artifacts.find((a: any) => a.status === 'completed');

      if (!latest) {
        return { status: 'processing', message: 'Result is still being generated in Google Studio.' };
      }

      const extension = latest.type === 'video' ? 'mp4' : 'm4a';
      const fileName = `research_${projectId}.${extension}`;
      const publicDir = path.join(process.cwd(), 'public/videos');
      
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      
      const outputPath = path.join(publicDir, fileName);

      this.logger.log(`Downloading ${latest.type} artifact for project ${projectId}...`);
      
      if (latest.type === 'video') {
        await this.notebookLM.downloadVideo(notebookId, outputPath);
      } else {
        await this.notebookLM.downloadAudio(notebookId, outputPath);
      }

      const videoUrl = `/videos/${fileName}`;
      await this.projectsService.updateStatus(projectId, 'completed', videoUrl);
      
      return { status: 'completed', videoUrl, type: latest.type };

    } catch (error) {
      this.logger.error(`Download failed for project ${projectId}: ${error.message}`);
      throw error;
    }
  }
}
