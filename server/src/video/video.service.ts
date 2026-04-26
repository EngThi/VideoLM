
import { Injectable, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import * as ffprobePath from 'ffprobe-static';
import { PassThrough } from 'stream';
import { ProjectsService } from '../projects/projects.service';
import { VideoGateway } from './video.gateway';
import { AiService } from '../ai/ai.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const execAsync = promisify(exec);

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private enginesPath = process.env.HOMES_ENGINE_PATH || '/path/to/HOMES-Engine';

  constructor(
    private projectsService: ProjectsService,
    private videoGateway: VideoGateway,
    @Inject(forwardRef(() => AiService))
    private aiService: AiService,
    @InjectQueue('video-render') private readonly renderQueue: Queue,
  ) {

    // Configura fluent-ffmpeg para usar binários estáticos
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath as string);
      this.logger.log(`FFmpeg path set to: ${ffmpegPath}`);
    }
    if (ffprobePath && ffprobePath.path) {
      ffmpeg.setFfprobePath(ffprobePath.path);
      this.logger.log(`FFprobe path set to: ${ffprobePath.path}`);
    }
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private generateSrt(script: string, totalDuration: number): string {
    if (!script || !totalDuration || isNaN(totalDuration) || totalDuration <= 0) {
      this.logger.warn('Skipping SRT generation: Script is empty or duration is invalid.');
      return '';
    }
    const rawLines = script.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g) || [];
    const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return '';
    
    const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
    if (totalChars === 0) return '';

    let srtContent = '';
    let currentTime = 0;
    
    const formatTime = (seconds: number) => {
      if (isNaN(seconds) || seconds < 0) seconds = 0;
      const date = new Date(0);
      date.setSeconds(seconds);
      const ms = Math.floor((seconds % 1) * 1000);
      try {
        return date.toISOString().substr(11, 8) + ',' + ms.toString().padStart(3, '0');
      } catch (e) {
        return '00:00:00,000';
      }
    };

    lines.forEach((line, i) => {
      const weight = line.length / totalChars;
      const duration = weight * totalDuration;
      const start = currentTime;
      const end = currentTime + duration;
      currentTime = end;
      
      srtContent += `${i + 1}\n`;
      srtContent += `${formatTime(start)} --> ${formatTime(end)}\n`;
      srtContent += `${line.trim()}\n\n`;
    });
    return srtContent;
  }

  private getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
            this.logger.warn(`ffprobe failed: ${err.message}`);
            return resolve(0);
        }
        const duration = metadata.format.duration;
        resolve(duration || 0);
      });
    });
  }

  // =========================================================================
  // SCENE RENDERING
  // =========================================================================

  async createClip(
    imagePath: string,
    outputPath: string,
    duration: number,
    index: number,
    isLast: boolean = false
  ): Promise<void> {
    const fps = 25;
    const targetDurationFrames = Math.ceil(duration * fps);
    const outputDuration = isLast ? duration + 5 : duration;
    
    // Dynamic Ken Burns logic based on index
    const zoomCmd = index % 2 === 0 
      ? `zoompan=z='min(zoom+0.0015,1.5)':d=${targetDurationFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720:fps=${fps}`
      : `zoompan=z='min(zoom+0.0015,1.5)':d=${targetDurationFrames}:x='if(eq(on,1),iw/2,x-1)':y='if(eq(on,1),ih/2,y)':s=1280x720:fps=${fps}`;
    
    const finalDurationFrames = Math.ceil(outputDuration * fps);
    const finalZoomCmd = zoomCmd.replace(`d=${targetDurationFrames}`, `d=${finalDurationFrames}`);
    
    const ffmpegBin = ffmpegPath || 'ffmpeg';
    // Adicionando Crossfade e movimentação Ken Burns mais suave
    const cmd = `"${ffmpegBin}" -y -threads 2 -loop 1 -i "${imagePath}" -vf "scale=1920:-2,${finalZoomCmd},fade=t=in:st=0:d=1,fade=t=out:st=${outputDuration-1}:d=1" -c:v libx264 -t ${outputDuration} -pix_fmt yuv420p -preset ultrafast "${outputPath}"`;
    
    await execAsync(cmd);
  }

  private async runInParallel<T, R>(
    items: T[], 
    concurrency: number, 
    task: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const results: any[] = new Array(items.length);
    const executing = new Set<Promise<any>>();
    
    for (let i = 0; i < items.length; i++) {
      const p = Promise.resolve().then(() => task(items[i], i));
      results[i] = p;
      executing.add(p);
      
      const clean = () => executing.delete(p);
      p.then(clean).catch(clean);
      
      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }
    
    return Promise.all(results);
  }

  private async renderAllClips(
    tempDir: string, 
    imageFiles: Express.Multer.File[], 
    totalDuration: number
  ): Promise<string[]> {
    const durationPerImage = totalDuration / imageFiles.length;
    const concurrencyLimit = 3; // Limit to 3 concurrent FFmpeg processes to avoid CPU exhaustion
    
    this.logger.log(`Rendering ${imageFiles.length} clips in parallel (limit: ${concurrencyLimit})...`);
    this.videoGateway.broadcastProgress('dev-session', 5, 'rendering_clips');

    let completed = 0;

    const renderTask = async (file: Express.Multer.File, i: number) => {
      const imgPath = path.join(tempDir, `source_${i}.png`);
      const clipPath = path.join(tempDir, `clip_${i}.mp4`);
      const isLast = i === imageFiles.length - 1;

      fs.writeFileSync(imgPath, file.buffer);
      
      try {
          await this.createClip(imgPath, clipPath, durationPerImage, i, isLast);
          completed++;
          const percent = 5 + Math.round((completed / imageFiles.length) * 40);
          this.videoGateway.broadcastProgress('dev-session', percent, 'rendering_clips');
          return clipPath;
      } catch (e) {
          this.logger.error(`Failed to render clip ${i}:`, e);
          throw e; 
      }
    };

    return this.runInParallel(imageFiles, concurrencyLimit, renderTask);
  }

  // =========================================================================
  // FFMPEG COMPLEX FILTERS
  // =========================================================================

  private buildComplexFilter(srtPath?: string, bgMusicPath?: string) {
    const filterComplex: any[] = [];
    let videoLabel = '0:v';
    let audioLabel = '1:a';

    if (srtPath) {
        const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        filterComplex.push({
            filter: 'subtitles',
            options: { 
              filename: escapedSrtPath, 
              force_style: 'Alignment=2,OutlineColour=&H00000000,BorderStyle=3,Outline=1,Shadow=0,Fontname=Arial,FontSize=24,PrimaryColour=&H0000FFFF,Bold=1' 
            },
            inputs: '0:v',
            outputs: 'vsubtitled'
        });
        videoLabel = '[vsubtitled]';
    }

    if (bgMusicPath) {
        // Smart Ducking: Use sidechain compression on narration to duck BG music
        filterComplex.push({
            filter: 'sidechaincompress',
            options: { level_in: '0.5', threshold: '0.015', ratio: '20', attack: '200', release: '1000' },
            inputs: ['2:a', '1:a'], // [main_input, sidechain_input]
            outputs: 'bg_ducked'
        });

        // Mix the original narration with the ducked background music
        filterComplex.push({
            filter: 'amix',
            options: { inputs: 2, duration: 'first' },
            inputs: ['1:a', 'bg_ducked'],
            outputs: 'amixed'
        });
        audioLabel = '[amixed]';
    }

    return { filterComplex, videoLabel, audioLabel };
  }

  // =========================================================================
  // MAIN PIPELINE
  // =========================================================================

  /**
   * Mantém o disco limpo removendo arquivos temporários e vídeos antigos (>24h).
   * Protege os vídeos de demonstração principais.
   */
  private async maintainDiskSpace() {
    try {
      const tempRoot = path.join(process.cwd(), 'temp');
      const videosDir = path.join(process.cwd(), 'public/videos');
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 Horas

      const cleanup = (dir: string, prefix?: string) => {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          try {
            const stats = fs.statSync(itemPath);
            
            // PROTEÇÃO: Não deleta os vídeos premium que acabamos de gerar!
            if (item.includes('05163177') || item.includes('79471770')) continue;

            if (now - stats.mtimeMs > maxAge) {
              if (prefix && !item.startsWith(prefix)) continue;
              this.logger.log(`[HOUSEKEEPING] Removendo item antigo: ${item}`);
              fs.rmSync(itemPath, { recursive: true, force: true });
            }
          } catch (err) { /* Ignora se o arquivo sumiu no meio do loop */ }
        }
      };

      cleanup(tempRoot);
      cleanup(videosDir, 'research_'); // Limpa apenas vídeos de pesquisa antigos
      cleanup(videosDir, 'final_');    // Limpa montagens manuais antigas

    } catch (e) {
      this.logger.error('Falha na manutenção de disco', e.stack);
    }
  }


  /**
   * Monta o vídeo padrão (Narração Gerada + Imagens) - Adds job to BullMQ
   */
  async assembleVideo(
    audioFile: Express.Multer.File,
    imageFiles: Express.Multer.File[],
    inputDuration: number,
    script?: string,
    bgMusicFile?: Express.Multer.File,
    externalTempDir?: string,
    projectId: string = 'dev-session',
    signal?: AbortSignal,
  ): Promise<string> {
    this.logger.log(`🎬 Adding assembly to queue for project: ${projectId}`);

    // Save to disk first so BullMQ doesn't bloat Redis with buffers.
    const tempRoot = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempRoot)) fs.mkdirSync(tempRoot, { recursive: true });

    const jobId = Date.now().toString();
    const jobDir = path.join(tempRoot, `queue_${jobId}`);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

    const audioPath = path.join(jobDir, 'audio.wav');
    // Ensure we handle Multer Buffer objects correctly depending on structure
    const getBuffer = (file: any): Buffer => {
        if (!file) return Buffer.from([]);
        if (Buffer.isBuffer(file)) return file;

        if (file.buffer) {
             if (Buffer.isBuffer(file.buffer)) return file.buffer;
             if (Array.isArray(file.buffer)) return Buffer.from(file.buffer);
             if (typeof file.buffer === 'object' && 'data' in file.buffer) {
                 return Buffer.from(file.buffer.data);
             }
             if (typeof file.buffer === 'object') {
                  const values = Object.values(file.buffer);
                  if (values.length > 0 && typeof values[0] === 'number') {
                       return Buffer.from(values as number[]);
                  }
             }
             return Buffer.from(file.buffer);
        }

        if (Array.isArray(file)) return Buffer.from(file);
        if (typeof file === 'object' && 'data' in file) return Buffer.from(file.data);
        if (typeof file === 'object') {
             const values = Object.values(file);
             if (values.length > 0 && typeof values[0] === 'number') {
                  return Buffer.from(values as number[]);
             }
        }
        return Buffer.from(file);
    };

    const audioBuffer = getBuffer(audioFile);
    if (audioBuffer.length === 0) {
        throw new Error("Failed to write empty audio buffer to disk");
    }
    fs.writeFileSync(audioPath, audioBuffer);

    let bgMusicPath: string | undefined;
    if (bgMusicFile && bgMusicFile.buffer) {
        bgMusicPath = path.join(jobDir, 'bgMusic.mp3');
        const bgMusicBuffer = getBuffer(bgMusicFile);
        fs.writeFileSync(bgMusicPath, bgMusicBuffer);
    }

    const imagePaths: string[] = [];
    for (let i = 0; i < imageFiles.length; i++) {
        const imgPath = path.join(jobDir, `image_${i}.png`);
        const imgBuffer = getBuffer(imageFiles[i]);
        fs.writeFileSync(imgPath, imgBuffer);
        imagePaths.push(imgPath);
    }

    // Add job to Queue. BullMQ processor will handle the actual processing
    // synchronously based on concurrency limit.
    const finalFileName = `${projectId || 'dev'}_${jobId}.mp4`;
    const videoUrl = `/videos/${finalFileName}`;

    await this.renderQueue.add('assemble', {
        audioPath,
        imagePaths,
        inputDuration,
        script,
        bgMusicPath,
        externalTempDir: jobDir,
        projectId
    }, {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false
    });

    return videoUrl;
  }

  /**
   * Executed by the worker to actually process the video
   */
  async processAssembly(
    audioPath: string,
    imagePaths: string[],
    inputDuration: number,
    script?: string,
    bgMusicPath?: string,
    externalTempDir?: string,
    projectId: string = 'dev-session',
    signal?: AbortSignal,
  ): Promise<string> {
    this.logger.log(`🎬 Starting processAssembly for project: ${projectId}`);
    await this.maintainDiskSpace();

    const videosDir = path.join(process.cwd(), 'public/videos');
    if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

    // The job directory acts as our temp dir
    const tempDir = externalTempDir;

    const finalFileName = `${projectId || 'dev'}_${path.basename(tempDir).replace('queue_', '')}.mp4`;
    const finalPath = path.join(videosDir, finalFileName);
    const videoUrl = `/videos/${finalFileName}`;

    if (projectId !== 'dev-session') await this.projectsService.updateStatus(projectId, 'processing');

    return new Promise(async (resolve, reject) => {
      try {
        let totalDuration = await this.getAudioDuration(audioPath);
        if (!totalDuration || isNaN(totalDuration) || totalDuration <= 0) totalDuration = inputDuration;

        let srtPath: string | undefined;
        if (script && totalDuration > 0) {
            srtPath = path.join(tempDir, 'subtitles.srt');
            const srtContent = this.generateSrt(script, totalDuration);
            if (srtContent) fs.writeFileSync(srtPath, srtContent, 'utf-8');
            else srtPath = undefined;
        }

        // To reuse renderAllClips we map the paths back to pseudo-multer files
        // but now renderAllClips actually expects the multer file. Let's fix that internally or map it.
        const pseudoImageFiles: any[] = imagePaths.map(p => ({ buffer: fs.readFileSync(p), originalname: p }));

        const clipPaths = await this.renderAllClips(tempDir, pseudoImageFiles, totalDuration);
        const concatListPath = path.join(tempDir, 'concat_list.txt');
        fs.writeFileSync(concatListPath, clipPaths.map(p => `file '${p}'`).join('\n'));

        const { filterComplex, videoLabel, audioLabel } = this.buildComplexFilter(srtPath, bgMusicPath);
        const command = ffmpeg(concatListPath).inputOptions(['-f concat', '-safe 0']).input(audioPath);
        if (bgMusicPath) command.input(bgMusicPath);
        if (filterComplex.length > 0) command.complexFilter(filterComplex);

        const outputOptions = ['-c:v libx264', '-preset superfast', '-pix_fmt yuv420p', '-shortest', '-threads 2'];
        if (filterComplex.length > 0) outputOptions.push(`-map ${videoLabel}`, `-map ${audioLabel}`);
        else outputOptions.push('-map 0:v', '-map 1:a');

        command.outputOptions(outputOptions)
          .on('end', () => {
            if (projectId !== 'dev-session') this.projectsService.updateStatus(projectId, 'completed', videoUrl);
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
            resolve(videoUrl);
          })
          .on('error', (err) => {
             this.logger.error(`🚨 Assembly Task Error: ${err.message}`);
             if (projectId !== 'dev-session') this.projectsService.updateStatus(projectId, 'error', undefined, err.message);
             reject(err);
          });

        if (signal) {
          signal.addEventListener('abort', () => {
            this.logger.warn(`🛑 Job aborted, killing ffmpeg process for project: ${projectId}`);
            command.kill('SIGKILL');
            reject(new Error('Job aborted by BullMQ'));
          });
        }

        command.save(finalPath);
      } catch (error) {
        this.logger.error(`🚨 Assembly Task Error: ${error.message}`);
        if (projectId !== 'dev-session') this.projectsService.updateStatus(projectId, 'error', undefined, error.message);
        reject(error);
      }
    });
  }

  /**
   * Orquestra a montagem completa de um vídeo baseado em pesquisa factual
   */
  async assembleResearchVideo(projectId: string): Promise<string> {
    const project = await this.projectsService.findOne(projectId);
    // Remove the extra 'server/' because the path is already relative to the project root in development
    const audioPath = path.join(process.cwd(), 'public', project.videoPath); 
    
    if (!fs.existsSync(audioPath)) {
      this.logger.error(`Audio not found at: ${audioPath}`);
      throw new BadRequestException('Research audio file not found on disk.');
    }

    const prompts = project.metadata?.storyboardPrompts;
    if (!prompts || prompts.length === 0) {
      throw new BadRequestException('Storyboard prompts not found. Generate storyboard first.');
    }

    this.logger.log(`🎬 Iniciando montagem de vídeo factual para o projeto: ${projectId}`);
    await this.maintainDiskSpace();
    await this.projectsService.updateStatus(projectId, 'processing');

    const processResearchTask = async () => {
      try {
        const tempDir = path.join(process.cwd(), 'temp', `research_${projectId}_${Date.now()}`);
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // 1. Gerar Imagens em lote
        this.logger.log(`🎨 Gerando ${prompts.length} imagens para o storyboard...`);
        const imageUrls = await this.aiService.generateImages(prompts);
        
        // 2. Preparar arquivos de imagem
        const imageFiles: any[] = await Promise.all(imageUrls.map(async (url, i) => {
            const buffer = url.startsWith('data:image') 
              ? Buffer.from(url.split(',')[1], 'base64')
              : Buffer.from(await (await fetch(url)).arrayBuffer());
            return { buffer, originalname: `image_${i}.png` };
        }));

        // 3. Renderizar Clipes e Concatenação
        const totalDuration = await this.getAudioDuration(audioPath);
        const clipPaths = await this.renderAllClips(tempDir, imageFiles, totalDuration);

        const finalFileName = `final_research_${projectId}.mp4`;
        const finalPath = path.join(process.cwd(), 'public/videos', finalFileName);
        const videoUrl = `/videos/${finalFileName}`;

        // 4. Concatenação Final com Áudio Factual
        const concatListPath = path.join(tempDir, 'concat_list.txt');
        fs.writeFileSync(concatListPath, clipPaths.map(p => `file '${p}'`).join('\n'));

        ffmpeg(concatListPath)
          .inputOptions(['-f concat', '-safe 0'])
          .input(audioPath)
          .outputOptions(['-c:v libx264', '-preset superfast', '-pix_fmt yuv420p', '-shortest', '-threads 2'])
          .on('end', () => {
             this.projectsService.updateStatus(projectId, 'completed', videoUrl);
             this.logger.log(`✅ Vídeo Factual Concluído: ${videoUrl}`);
          })
          .on('error', (err) => {
             this.logger.error(`FFmpeg Error: ${err.message}`);
             this.projectsService.updateStatus(projectId, 'error', undefined, err.message);
          })
          .save(finalPath);

      } catch (err) {
        this.logger.error(`🚨 Falha na montagem factual: ${err.message}`);
        this.projectsService.updateStatus(projectId, 'error', undefined, err.message);
      }
    };

    processResearchTask();
    return "Assembly started in background";
  }

  // =========================================================================
  // LEGACY PYTHON ENGINE FALLBACK
  // =========================================================================

  async generateVideo(
    projectId: string,
    theme: string = 'yellow_punch',
  ): Promise<{ status: string; videoPath?: string; error?: string }> {
    try {
      const project = await this.projectsService.findOne(projectId);
      if (!project.script) { throw new BadRequestException('Project has no script'); }
      
      await this.projectsService.updateStatus(projectId, 'processing');
      const scriptFile = path.join(this.enginesPath, 'scripts', `${projectId}.txt`);
      fs.writeFileSync(scriptFile, project.script, 'utf-8');
      
      const cmd = `cd ${this.enginesPath} && python main.py --script ${scriptFile} --theme ${theme}`;
      const { stdout } = await execAsync(cmd, { timeout: 600000 });
      const videoPath = stdout.trim();
      
      if (!fs.existsSync(videoPath)) { throw new Error(`Video file not found at ${videoPath}`); }
      
      await this.projectsService.updateStatus(projectId, 'done', videoPath);
      return { status: 'done', videoPath };
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      await this.projectsService.updateStatus(projectId, 'error', undefined, errorMsg);
      return { status: 'error', error: errorMsg };
    }
  }

  async getStatus(projectId: string): Promise<any> {
    const project = await this.projectsService.findOne(projectId);
    return { status: project.status, videoPath: project.videoPath, error: project.error };
  }

  async getMusicList(): Promise<string[]> {
    const musicDir = path.join(process.cwd(), 'data/music');
    if (!fs.existsSync(musicDir)) return [];
    
    return fs.readdirSync(musicDir).filter(file => 
      ['.mp3', '.wav', '.m4a'].includes(path.extname(file).toLowerCase())
    );
  }
}
