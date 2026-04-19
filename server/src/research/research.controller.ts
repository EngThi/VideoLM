
import { Controller, Post, Body, Param, UseGuards, Request, BadRequestException, Get } from '@nestjs/common';
import { ResearchService } from './research.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/research')
@UseGuards(JwtAuthGuard)
export class ResearchController {
  constructor(private researchService: ResearchService) {}

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
    @Body('type') type: 'audio' | 'video' = 'audio',
  ) {
    return this.researchService.startNotebookLMResearch(projectId, type);
  }

  /**
   * Tenta baixar o resultado da pesquisa do Google Studio para o servidor local
   */
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
