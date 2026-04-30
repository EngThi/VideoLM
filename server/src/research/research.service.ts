import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { NotebookLMEngine } from './notebook-lm.engine';
import { AiService } from '../ai/ai.service';
import { VideoService } from '../video/video.service';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(
    private projectsService: ProjectsService,
    private notebookLM: NotebookLMEngine,
    private aiService: AiService,
    private videoService: VideoService,
  ) {}

  private getBrandingMaskPath(): string | undefined {
    const candidates = [
      path.join(process.cwd(), 'public/logo_mask.gif'),
      path.join(process.cwd(), '..', 'dist', 'logo_mask.gif'),
      path.join(process.cwd(), 'public/logo_mask.png'),
      path.join(process.cwd(), '..', 'dist', 'logo_mask.png'),
    ];

    return candidates.find(candidate => fs.existsSync(candidate));
  }

  private async applyBrandingOverlay(inputPath: string, artifactType: string): Promise<string> {
    if (artifactType !== 'video' && artifactType !== 'infographic') return inputPath;

    const maskPath = this.getBrandingMaskPath();
    if (!maskPath) {
      this.logger.warn('Branding mask not found. Returning raw NotebookLM artifact.');
      return inputPath;
    }

    const ext = path.extname(inputPath);
    const tempOutput = inputPath.replace(new RegExp(`${ext}$`), `.branded${ext}`);
    const overlayFilter = '[1:v]scale=300:-1[wm];[0:v][wm]overlay=main_w-overlay_w-20:main_h-overlay_h-20:shortest=1[v]';

    const args = artifactType === 'video'
      ? [
          '-y',
          '-i', inputPath,
          '-ignore_loop', '0',
          '-i', maskPath,
          '-filter_complex', overlayFilter,
          '-map', '[v]',
          '-map', '0:a?',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'copy',
          '-movflags', '+faststart',
          tempOutput,
        ]
      : [
          '-y',
          '-i', inputPath,
          '-ignore_loop', '0',
          '-i', maskPath,
          '-filter_complex', overlayFilter,
          '-map', '[v]',
          '-frames:v', '1',
          tempOutput,
        ];

    try {
      this.logger.log(`Applying branding mask to ${artifactType}: ${path.basename(inputPath)}`);
      await execFileAsync('ffmpeg', args, { maxBuffer: 20 * 1024 * 1024 });
      fs.renameSync(tempOutput, inputPath);
      return inputPath;
    } catch (error) {
      this.logger.warn(`Branding overlay failed for ${path.basename(inputPath)}: ${error.message}`);
      try {
        if (fs.existsSync(tempOutput)) fs.rmSync(tempOutput, { force: true });
      } catch {}
      return inputPath;
    }
  }

  private normalizeSourceUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      throw new BadRequestException('Empty source URL is not allowed.');
    }

    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    try {
      const parsed = new URL(withScheme);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('unsupported protocol');
      }
      return parsed.toString();
    } catch {
      throw new BadRequestException(`Invalid source URL: ${rawUrl}`);
    }
  }

  /**
   * Adiciona URLs ao projeto e persiste na coluna 'sources'
   */
  async addSources(projectId: string, urls: string[]) {
    const normalizedUrls = Array.from(
      new Set(urls.map((url) => this.normalizeSourceUrl(url))),
    );

    this.logger.log(`Adding ${normalizedUrls.length} sources to project ${projectId}`);
    
    // 1. Atualiza metadados
    await this.projectsService.updateMetadata(projectId, { 
      lastSourceUpdate: new Date().toISOString(),
      sourceCount: normalizedUrls.length
    });

    // 2. Persiste as fontes de forma robusta
    return this.projectsService.updateSources(projectId, normalizedUrls);
  }

  saveNotebookLMCookies(profileId: string, cookies: unknown) {
    return this.notebookLM.saveCookiesProfile(profileId, cookies);
  }

  listNotebookLMProfiles() {
    return this.notebookLM.listProfiles();
  }

  async listNotebookLMNotebooks(profileId?: string) {
    const raw = await this.notebookLM.listNotebooks(profileId);
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }

  async listNotebookLMSources(notebookId: string, profileId?: string) {
    const raw = await this.notebookLM.listSources(notebookId, profileId);
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }

  async addFilesToNotebook(projectId: string, notebookId: string, files: Array<{ path: string; originalname?: string }>, profileId?: string) {
    if (!notebookId) throw new BadRequestException('Notebook ID is required for file upload.');
    if (!files?.length) throw new BadRequestException('At least one file is required.');

    await this.projectsService.updateMetadata(projectId, { notebookId, nlmProfileId: profileId });
    const results = [];
    for (const file of files) {
      try {
        const output = await this.notebookLM.addFileSource(notebookId, file.path, profileId);
        results.push({ file: file.originalname || file.path, status: 'added', output });
      } catch (error) {
        this.logger.warn(`Failed to add file ${file.originalname || file.path}: ${error.message}`);
        results.push({ file: file.originalname || file.path, status: 'error', error: error.message });
      }
    }

    return { notebookId, profileId, results };
  }

  /**
   * Orquestra a criação do notebook e o disparo da geração de conteúdo
   */
  async startNotebookLMResearch(
    projectId: string,
    type: 'audio' | 'video' | 'infographic' = 'audio',
    style: string = 'classic',
    options: { liveResearch?: boolean; notebookId?: string; profileId?: string } = {},
  ) {
    const project = await this.projectsService.findOne(projectId);
    
    if ((!project.sources || project.sources.length === 0) && !options.notebookId) {
      throw new NotFoundException('No sources found for this project. Add URLs first.');
    }

    await this.projectsService.updateStatus(projectId, 'researching');
    
    let notebookId = options.notebookId || project.metadata?.notebookId;
    const profileId = options.profileId || project.metadata?.nlmProfileId;

    try {
      // 1. Criar o Notebook se não existir
      if (!notebookId || notebookId === 'placeholder-id' || notebookId.startsWith('notebook_')) {
        this.logger.log(`Creating new Google Notebook for project ${projectId}...`);
        notebookId = await this.notebookLM.createNotebook(`Factory: ${project.title || project.id}`, profileId);
        await this.projectsService.updateMetadata(projectId, { notebookId, nlmProfileId: profileId });
      } else if (options.notebookId || options.profileId) {
        await this.projectsService.updateMetadata(projectId, { notebookId, nlmProfileId: profileId });
      }

      // 2. Injetar as fontes
      const submittedSources = project.sources || [];
      this.logger.log(`Feeding ${submittedSources.length} sources into notebook ${notebookId}...`);
      let addedSourceCount = 0;
      for (const source of submittedSources) {
        try {
          await this.notebookLM.addSource(notebookId, source, profileId);
          addedSourceCount += 1;
        } catch (sourceErr) {
          this.logger.warn(`Failed to add source ${source}, skipping: ${sourceErr.message}`);
        }
      }

      if (submittedSources.length > 0 && addedSourceCount === 0) {
        throw new BadRequestException('No valid sources were accepted by NotebookLM. Use full http:// or https:// URLs.');
      }

      if (options.liveResearch) {
        const query = project.topic && project.topic !== 'VideoLM research job'
          ? project.topic
          : submittedSources.join(' ');
        this.logger.log(`🚀 Performing Live Research for topic: ${query}`);
        await this.notebookLM.researchStart(notebookId, query, profileId);
      } else {
        this.logger.log('Skipping Live Research expansion; using only submitted sources.');
      }

      // 3. Disparar a geração (Deep Dive)
      this.logger.log(`Triggering ${type} overview (Style: ${style}) for notebook ${notebookId}`);
      
      if (type === 'video') {
        return this.notebookLM.createVideoOverview(notebookId, style, profileId);
      }
      if (type === 'infographic') {
        return this.notebookLM.createInfographic(notebookId, style, undefined, profileId);
      }
      return this.notebookLM.createAudioOverview(notebookId, profileId);

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
    const profileId = project.metadata?.nlmProfileId;

    if (!notebookId) throw new NotFoundException('Notebook ID not found for this project.');

    try {
      const statusRaw = await this.notebookLM.checkStatus(notebookId, profileId);
      const artifacts = JSON.parse(statusRaw);
      
      // PRIORIDADE: Busca primeiro um VÍDEO completo, se não achar, busca ÁUDIO, e por fim INFOGRÁFICO.
      const latest = artifacts.find((a: any) => a.type === 'video' && a.status === 'completed') 
                  || artifacts.find((a: any) => a.type === 'audio' && a.status === 'completed')
                  || artifacts.find((a: any) => a.type === 'infographic' && a.status === 'completed');

      if (!latest) {
        return { status: 'processing', message: 'Result is still being generated in Google Studio.' };
      }

      let extension = 'mp4';
      if (latest.type === 'audio') extension = 'm4a';
      if (latest.type === 'infographic') extension = 'png';

      const fileName = `research_${projectId}.${extension}`;
      const publicDir = path.join(process.cwd(), 'public/videos');
      
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      
      const outputPath = path.join(publicDir, fileName);

      this.logger.log(`Downloading ${latest.type} artifact for project ${projectId}...`);
      
      if (latest.type === 'video') {
        await this.notebookLM.downloadVideo(notebookId, outputPath, profileId);
      } else if (latest.type === 'audio') {
        await this.notebookLM.downloadAudio(notebookId, outputPath, profileId);
      } else if (latest.type === 'infographic') {
        await this.notebookLM.downloadInfographic(notebookId, outputPath, profileId);
      }

      await this.applyBrandingOverlay(outputPath, latest.type);

      // 4. Se for um Pipeline Híbrido, precisamos gerar o roteiro e áudio customizados
      if (project.title.includes('STRESS A') || project.title.includes('Hybrid')) {
          this.logger.log(`🧬 Hybrid Bridge Active: Generating professional storytelling for ${projectId}`);
          
          // 4.1 Baixar Report e gerar roteiro Gemini
          const reportPath = path.join(process.cwd(), 'temp', `report_${projectId}.md`);
          await this.notebookLM.downloadReport(notebookId, reportPath);
          const facts = fs.readFileSync(reportPath, 'utf-8');
          
          const { text: script } = await this.aiService.generate(`
            Fatos: ${facts.slice(0, 4000)}
            Tarefa: Crie um roteiro de 1 min. Use [TECH_START] e [TECH_END] nos dados técnicos.
          `, 'gemini-3-flash-preview');

          // 4.2 Gerar Áudio Normalizado
          const { audioBuffer } = await this.aiService.generateVoiceover(script);
          const audioPath = path.join(process.cwd(), 'temp', `audio_${projectId}.wav`);
          fs.writeFileSync(audioPath, audioBuffer);

          // 4.3 Disparar Montagem Final com B-Roll
          const videoUrlFinal = await this.videoService.assembleVideo(
              { buffer: audioBuffer, originalname: 'audio.wav' } as any,
              [], // O service buscará os prompts no metadata
              0,
              script,
              undefined,
              undefined,
              projectId,
              undefined,
              { buffer: fs.readFileSync(outputPath), originalname: 'infographic.png' } as any
          );
          return { status: 'completed', videoUrl: videoUrlFinal };
      }

      const videoUrl = `/videos/${fileName}`;
      await this.projectsService.updateStatus(projectId, 'completed', videoUrl);
      
      return { status: 'completed', videoUrl, type: latest.type };

    } catch (error) {
      this.logger.error(`Download failed for project ${projectId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gera prompts de imagem baseados no contexto da pesquisa concluída
   */
  async generateVisualsForResearch(projectId: string) {
    const project = await this.projectsService.findOne(projectId);
    
    if (!project.sources || project.sources.length === 0) {
      throw new NotFoundException('No sources found for storyboard generation.');
    }

    this.logger.log(`Iniciando geração de storyboard para o projeto de pesquisa: ${projectId}`);
    
    const prompts = await this.aiService.generateStoryboardFromResearch(project.topic, project.sources);
    
    // Salva os prompts nos metadados do projeto
    await this.projectsService.updateMetadata(projectId, { 
      storyboardPrompts: prompts,
      storyboardGeneratedAt: new Date().toISOString()
    });

    return { status: 'success', prompts };
  }

  /**
   * Dispara a montagem do vídeo final baseado na pesquisa
   */
  async assembleResearchVideo(projectId: string) {
    return this.videoService.assembleResearchVideo(projectId);
  }

  /**
   * PIPELINE 200% (ABSOLUTE CINEMA): Híbrido NLM + Gemini
   * Usa NLM para fatos/infográficos e Gemini para storytelling/voz.
   */
  async startHybridAbsolutePipeline(projectId: string) {
    const project = await this.projectsService.findOne(projectId);
    this.logger.log(`🚀 Iniciando Pipeline Híbrido Absolute Cinema para: ${project.title}`);

    // 1. Orquestração NLM (Live Research + Report + Infographic)
    let notebookId = project.metadata?.notebookId;
    if (!notebookId || notebookId === 'placeholder-id') {
      notebookId = await this.notebookLM.createNotebook(`Hybrid: ${project.title}`);
      await this.projectsService.updateMetadata(projectId, { notebookId });
    }

    // Injetar fontes se necessário e rodar Live Research
    for (const source of project.sources || []) {
      await this.notebookLM.addSource(notebookId, source);
    }
    await this.notebookLM.researchStart(notebookId, project.topic);
    
    // Gerar artefatos Fatuais
    await this.notebookLM.createReport(notebookId);
    await this.notebookLM.createInfographic(notebookId, 'bento_grid', 'portrait');

    return { status: 'processing', message: 'NLM está extraindo fatos e gerando infográficos...' };
  }
}
