
import { Controller, Post, Body, Param, BadRequestException, Get, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ResearchService } from './research.service';

@Controller('api/research')
export class ResearchController {
  constructor(private researchService: ResearchService) {}

  @Get('nlm/profiles')
  async listNlmProfiles() {
    return this.researchService.listNotebookLMProfiles();
  }

  @Post('nlm/profiles')
  async saveNlmProfile(
    @Body('profileId') profileId: string = 'default',
    @Body('cookies') cookies: unknown,
    @Body('cookiesJson') cookiesJson?: string,
  ) {
    let parsedCookies = cookies;
    if (cookiesJson) {
      try {
        parsedCookies = JSON.parse(cookiesJson);
      } catch {
        throw new BadRequestException('cookiesJson must be valid JSON.');
      }
    }

    if (!parsedCookies) {
      throw new BadRequestException('cookies or cookiesJson is required.');
    }

    return this.researchService.saveNotebookLMCookies(profileId, parsedCookies);
  }

  @Get('nlm/notebooks')
  async listNlmNotebooks(@Query('profileId') profileId?: string) {
    return this.researchService.listNotebookLMNotebooks(profileId);
  }

  @Get('nlm/notebooks/:notebookId/sources')
  async listNlmSources(
    @Param('notebookId') notebookId: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.researchService.listNotebookLMSources(notebookId, profileId);
  }

  /**
   * Adiciona fontes (links/textos) a um projeto para o NotebookLM estudar
   */
  @Post(':projectId/sources')
  async addSources(
    @Param('projectId') projectId: string,
    @Body('urls') urls: string[],
  ) {
    if (!urls || !Array.isArray(urls)) {
      throw new BadRequestException('A list of URLs is required');
    }
    return this.researchService.addSources(projectId, urls);
  }

  /**
   * Dispara o Deep Dive do NotebookLM (Geração de Áudio ou Vídeo Overview)
   */
  @Post(':projectId/trigger')
  async triggerResearch(
    @Param('projectId') projectId: string,
    @Body('type') type: 'audio' | 'video' | 'infographic' = 'audio',
    @Body('style') style: string = 'classic',
    @Body('stylePrompt') stylePrompt?: string,
    @Body('liveResearch') liveResearch: boolean = false,
    @Body('notebookId') notebookId?: string,
    @Body('profileId') profileId?: string,
    @Body('format') videoFormat?: string,
  ) {
    if (type === 'video' || type === 'infographic') {
      return this.researchService.startNotebookLMResearchInBackground(projectId, type, style, {
        liveResearch,
        notebookId,
        profileId,
        stylePrompt,
        videoFormat: videoFormat || 'brief',
      });
    }
    return this.researchService.startNotebookLMResearch(projectId, type, style, { liveResearch, notebookId, profileId, stylePrompt });
  }

  @Post(':projectId/source-files')
  @UseInterceptors(FilesInterceptor('files', 12, {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const uploadDir = path.join(process.cwd(), 'temp', 'nlm-uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`);
      },
    }),
  }))
  async addFileSources(
    @Param('projectId') projectId: string,
    @UploadedFiles() files: any[],
    @Body('notebookId') notebookId: string,
    @Body('profileId') profileId?: string,
  ) {
    return this.researchService.addFilesToNotebook(projectId, notebookId, files, profileId);
  }

  /**
   * Tenta baixar o resultado da pesquisa do Google Studio para o servidor local
   */
  @Get(':projectId/download')
  async downloadResearchResult(@Param('projectId') projectId: string) {
    return this.researchService.downloadResearchResult(projectId);
  }

  /**
   * Gera o storyboard visual baseado no contexto da pesquisa
   */
  /**
   * Dispara a montagem final do vídeo factual
   */
  @Post(':projectId/assemble')
  async assembleVideo(@Param('projectId') projectId: string) {
    return this.researchService.assembleResearchVideo(projectId);
  }
}
