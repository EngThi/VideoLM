import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffprobeStatic from 'ffprobe-static';
import { ProjectsService } from '../projects/projects.service';
import { VideoGateway } from './video.gateway';
import { AiService } from '../ai/ai.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const execAsync = promisify(exec);
const RENDER_TIMEOUT_MS = 30 * 60 * 1000;

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    @Inject(forwardRef(() => ProjectsService))
    private projectsService: ProjectsService,
    private videoGateway: VideoGateway,
    private aiService: AiService,
    @InjectQueue('video-render') private readonly renderQueue: Queue,
  ) {
    ffmpeg.setFfprobePath(ffprobeStatic.path);
    this.logger.log(`FFprobe path set to: ${ffprobeStatic.path}`);
  }

  // =========================================================================
  // FFMPEG CORE HELPERS
  // =========================================================================

  private async getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          this.logger.error(`Error probing audio: ${err.message}`);
          resolve(0);
          return;
        }
        resolve(metadata.format.duration || 0);
      });
    });
  }

  private generateSrt(script: string, totalDuration: number): string {
    const words = script.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return '';

    const wordsPerSecond = words.length / totalDuration;
    const wordsPerFrame = 5; // Mostra 5 palavras por legenda
    let srt = '';
    let index = 1;

    for (let i = 0; i < words.length; i += wordsPerFrame) {
      const startSec = i / wordsPerSecond;
      const endSec = Math.min((i + wordsPerFrame) / wordsPerSecond, totalDuration);

      const formatTime = (seconds: number) => {
        const date = new Date(0);
        date.setSeconds(seconds);
        const ms = Math.floor((seconds % 1) * 1000);
        return date.toISOString().substr(11, 8) + ',' + ms.toString().padStart(3, '0');
      };

      srt += `${index}\n${formatTime(startSec)} --> ${formatTime(endSec)}\n${words.slice(i, i + wordsPerFrame).join(' ')}\n\n`;
      index++;
    }
    return srt;
  }

  private async renderAllClips(tempDir: string, imageFiles: any[], totalDuration: number): Promise<string[]> {
    const durationPerImage = totalDuration / imageFiles.length;
    const clipPaths: string[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const imgPath = path.join(tempDir, `image_${i}.png`);
      fs.writeFileSync(imgPath, imageFiles[i].buffer);
      
      const clipPath = path.join(tempDir, `clip_${i}.mp4`);
      await this.createClip(imgPath, clipPath, durationPerImage);
      clipPaths.push(clipPath);
    }
    return clipPaths;
  }

  private async createClip(imgPath: string, outputPath: string, duration: number): Promise<void> {
    if (duration < 0.5 || isNaN(duration)) duration = 2; // Mínimo de 2s para segurança
    this.logger.log(`📹 Clip: ${path.basename(outputPath)} | Duration: ${duration.toFixed(2)}s`);

    return new Promise((resolve, reject) => {
      ffmpeg(imgPath)
        .loop(duration)
        .videoFilters([
          'scale=1280:720:force_original_aspect_ratio=increase',
          'crop=1280:720',
          `zoompan=z='min(zoom+0.0015,1.5)':d=${Math.ceil(duration * 25)}:s=1280x720:fps=25`
        ])
        .outputOptions(['-c:v libx264', '-preset ultrafast', '-t', duration.toFixed(3), '-pix_fmt yuv420p', '-threads 1'])
        .on('end', () => resolve())
        .on('error', (err) => {
            this.logger.error(`❌ FFmpeg createClip fail: ${err.message}`);
            reject(err);
        })
        .save(outputPath);
    });
  }

  private async updateRenderState(
    projectId: string,
    render: Record<string, any>,
  ) {
    if (!projectId || projectId === 'dev-session') return;
    const service = this.projectsService as any;
    if (typeof service.updateMetadata !== 'function') return;

    try {
      await service.updateMetadata(projectId, {
        render: {
          ...render,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to update render metadata for ${projectId}: ${error.message}`);
    }
  }

  private async renderImagePathClips(
    tempDir: string,
    imagePaths: string[],
    totalDuration: number,
    projectId: string,
  ): Promise<string[]> {
    const durationPerImage = totalDuration / imagePaths.length;
    const clipPaths: string[] = [];

    for (let i = 0; i < imagePaths.length; i++) {
      const clipPath = path.join(tempDir, `clip_${i}.mp4`);
      await this.updateRenderState(projectId, {
        stage: 'rendering_clips',
        progress: Math.round((i / imagePaths.length) * 45),
        currentFrame: null,
        currentClip: i + 1,
        totalClips: imagePaths.length,
      });
      this.videoGateway.broadcastProgress(projectId, Math.round((i / imagePaths.length) * 45), 'rendering_clips');
      await this.createClip(imagePaths[i], clipPath, durationPerImage);
      clipPaths.push(clipPath);
    }

    await this.updateRenderState(projectId, {
      stage: 'clips_ready',
      progress: 45,
      currentClip: imagePaths.length,
      totalClips: imagePaths.length,
    });
    return clipPaths;
  }

  private buildComplexFilter(srtPath?: string, bgMusicPath?: string, bRollPath?: string, bRollTiming?: { start: number; end: number }, maskPath?: string) {
    const filterComplex: any[] = [];
    let videoLabel = '0:v';
    let audioLabel = '1:a';
    
    let nextInputIndex = 2; 
    if (bgMusicPath) nextInputIndex++;
    const bRollInputIndex = nextInputIndex;
    if (bRollPath) nextInputIndex++;
    const maskInputIndex = nextInputIndex;

    // 1. Legendas
    if (srtPath) {
        const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        filterComplex.push({
            filter: 'subtitles',
            options: { 
              filename: escapedSrtPath, 
              force_style: 'Alignment=2,OutlineColour=&H00000000,BorderStyle=3,Outline=1,Shadow=0,Fontname=Arial,FontSize=24,PrimaryColour=&H0000FFFF,Bold=1' 
            },
            inputs: videoLabel,
            outputs: 'vsubtitled'
        });
        videoLabel = 'vsubtitled';
    }

    // 2. B-Roll Infográfico
    if (bRollPath && bRollTiming) {
        filterComplex.push({
            filter: 'scale',
            options: { w: '1080', h: '1920', force_original_aspect_ratio: 'decrease' },
            inputs: `${bRollInputIndex}:v`, 
            outputs: 'scaled_broll'
        });

        filterComplex.push({
            filter: 'overlay',
            options: { 
                x: '(main_w-overlay_w)/2', 
                y: '(main_h-overlay_h)/2',
                enable: `between(t,${bRollTiming.start},${bRollTiming.end})`
            },
            inputs: [videoLabel, 'scaled_broll'],
            outputs: 'voverlaid'
        });
        videoLabel = 'voverlaid';
    }

    // 3. Logo Mask (Absolute Cinema - inferior direito)
    const defaultGif = path.join(process.cwd(), 'public/logo_mask.gif');
    const distGif = path.join(process.cwd(), '..', 'dist', 'logo_mask.gif');
    const resolvedGif = fs.existsSync(defaultGif) ? defaultGif : (fs.existsSync(distGif) ? distGif : undefined);
    if (resolvedGif) {
        maskPath = resolvedGif;
        this.logger.log(`🎭 Branding Active: Applying ${path.basename(maskPath)} watermark.`);
    }

    if (maskPath) {
        filterComplex.push({
            filter: 'scale',
            options: { w: '250', h: '-1' }, 
            inputs: `${maskInputIndex}:v`,
            outputs: 'scaled_mask'
        });

        filterComplex.push({
            filter: 'overlay',
            options: { 
                x: 'main_w-overlay_w-20', 
                y: 'main_h-overlay_h-20'
            },
            inputs: [videoLabel, 'scaled_mask'],
            outputs: 'voverlaid_final'
        });
        videoLabel = 'voverlaid_final';
    }

    videoLabel = `[${videoLabel}]`;

    if (bgMusicPath) {
        filterComplex.push({
            filter: 'sidechaincompress',
            options: { level_in: '0.5', threshold: '0.015', ratio: '20', attack: '200', release: '1000' },
            inputs: ['2:a', '1:a'],
            outputs: 'bg_ducked'
        });

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

  private async maintainDiskSpace() {
    try {
      const tempRoot = path.join(process.cwd(), 'temp');
      const videosDir = path.join(process.cwd(), 'public/videos');
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000;

      const cleanup = (dir: string, prefix?: string) => {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);
        for (const item of items) {
          try {
            const itemPath = path.join(dir, item);
            const stats = fs.statSync(itemPath);
            if (item.includes('05163177') || item.includes('79471770')) continue;
            if (now - stats.mtimeMs > maxAge) {
              if (prefix && !item.startsWith(prefix)) continue;
              this.logger.log(`[HOUSEKEEPING] Removendo item antigo: ${item}`);
              fs.rmSync(itemPath, { recursive: true, force: true });
            }
          } catch (err) {}
        }
      };
      cleanup(tempRoot);
      cleanup(videosDir, 'research_');
      cleanup(videosDir, 'final_');
    } catch (e) {
      this.logger.error('Falha na manutenção de disco', e.stack);
    }
  }

  /**
   * Helper robusto para extrair Buffer de Multer Files ou Objetos Similares
   */
  private getBuffer(file: any): Buffer {
      if (!file) return Buffer.from([]);
      if (Buffer.isBuffer(file)) return file;
      if (file.buffer) {
           if (Buffer.isBuffer(file.buffer)) return file.buffer;
           if (Array.isArray(file.buffer)) return Buffer.from(file.buffer);
           if (typeof file.buffer === 'object' && 'data' in file.buffer) return Buffer.from(file.buffer.data);
           return Buffer.from(file.buffer);
      }
      if (Array.isArray(file)) return Buffer.from(file);
      if (typeof file === 'object' && 'data' in file) return Buffer.from(file.data);
      return Buffer.from(file);
  }

  async assembleVideo(
    audioFile: Express.Multer.File,
    imageFiles: Express.Multer.File[],
    inputDuration: number,
    script?: string,
    bgMusicFile?: Express.Multer.File,
    externalTempDir?: string,
    projectId: string = 'dev-session',
    signal?: AbortSignal,
    bRollFile?: Express.Multer.File,
  ): Promise<string> {
    this.logger.log(`🎬 Adding assembly to queue for project: ${projectId}`);

    const tempRoot = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempRoot)) fs.mkdirSync(tempRoot, { recursive: true });

    const jobId = Date.now().toString();
    const jobDir = path.join(tempRoot, `queue_${jobId}`);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

    const audioPath = path.join(jobDir, 'audio.wav');
    const audioBuffer = this.getBuffer(audioFile);
    if (audioBuffer.length === 0) throw new Error("Failed to write empty audio buffer to disk");
    fs.writeFileSync(audioPath, audioBuffer);

    let bgMusicPath: string | undefined;
    if (bgMusicFile) {
        bgMusicPath = path.join(jobDir, 'bgMusic.mp3');
        const bgMusicBuffer = this.getBuffer(bgMusicFile);
        if (bgMusicBuffer.length > 0) fs.writeFileSync(bgMusicPath, bgMusicBuffer);
        else bgMusicPath = undefined;
    }

    let bRollPath: string | undefined;
    if (bRollFile) {
        bRollPath = path.join(jobDir, 'infographic.png');
        const bRollBuffer = this.getBuffer(bRollFile);
        if (bRollBuffer.length > 0) fs.writeFileSync(bRollPath, bRollBuffer);
        else bRollPath = undefined;
    }

    const imagePaths: string[] = [];
    for (let i = 0; i < imageFiles.length; i++) {
        const imgPath = path.join(jobDir, `image_${i}.png`);
        const imgBuffer = this.getBuffer(imageFiles[i]);
        fs.writeFileSync(imgPath, imgBuffer);
        imagePaths.push(imgPath);
    }

    const finalFileName = `${projectId || 'dev'}_${jobId}.mp4`;
    const videoUrl = `/videos/${finalFileName}`;

    if (projectId !== 'dev-session') {
      await this.projectsService.updateStatus(projectId, 'queued', videoUrl);
      await this.updateRenderState(projectId, {
        stage: 'queued',
        progress: 0,
        imageCount: imagePaths.length,
        audioBytes: audioBuffer.length,
        estimatedDuration: inputDuration || null,
      });
    }

    await this.renderQueue.add('assemble', {
        audioPath,
        imagePaths,
        inputDuration,
        script,
        bgMusicPath,
        bRollPath,
        externalTempDir: jobDir,
        projectId
    }, {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false
    });

    return videoUrl;
  }

  async processAssembly(
    audioPath: string,
    imagePaths: string[],
    inputDuration: number,
    script?: string,
    bgMusicPath?: string,
    externalTempDir?: string,
    projectId: string = 'dev-session',
    signal?: AbortSignal,
    bRollPath?: string,
  ): Promise<string> {
    this.logger.log(`🎬 Starting processAssembly for project: ${projectId}`);
    this.logger.log(`📌 Inputs: Audio=${audioPath}, Images=${imagePaths.length}, ScriptLen=${script?.length || 0}, BG=${bgMusicPath}, BRoll=${bRollPath}`);
    await this.maintainDiskSpace();

    const videosDir = path.join(process.cwd(), 'public/videos');
    if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

    const tempDir = externalTempDir;
    const finalFileName = `${projectId || 'dev'}_${path.basename(tempDir).replace('queue_', '')}.mp4`;
    const finalPath = path.join(videosDir, finalFileName);
    const videoUrl = `/videos/${finalFileName}`;

    if (projectId !== 'dev-session') {
      await this.projectsService.updateStatus(projectId, 'processing', videoUrl);
      await this.updateRenderState(projectId, {
        stage: 'preparing',
        progress: 1,
        imageCount: imagePaths.length,
        startedAt: new Date().toISOString(),
      });
    }

    // Inicializa maskPath (Absolute Cinema 200%)
    let maskPath: string | undefined;
    const defaultGif = path.join(process.cwd(), 'public/logo_mask.gif');
    const distGif = path.join(process.cwd(), '..', 'dist', 'logo_mask.gif');
    const defaultPng = path.join(process.cwd(), 'public/logo_mask.png');
    if (fs.existsSync(defaultGif)) maskPath = defaultGif;
    else if (fs.existsSync(distGif)) maskPath = distGif;
    else if (fs.existsSync(defaultPng)) maskPath = defaultPng;

    return new Promise(async (resolve, reject) => {
      try {
        let totalDuration = await this.getAudioDuration(audioPath);
        if (!totalDuration || isNaN(totalDuration) || totalDuration <= 0) {
            totalDuration = inputDuration > 0 ? inputDuration : 10; // Mínimo de 10s
        }
        this.logger.log(`📏 Total Video Duration: ${totalDuration.toFixed(2)}s`);
        await this.updateRenderState(projectId, {
          stage: 'probing_audio',
          progress: 3,
          duration: totalDuration,
          imageCount: imagePaths.length,
        });

        let srtPath: string | undefined;
        let bRollTiming: { start: number; end: number } | undefined;

        if (script && totalDuration > 0) {
            srtPath = path.join(tempDir, 'subtitles.srt');
            const srtContent = this.generateSrt(script, totalDuration);
            if (srtContent) fs.writeFileSync(srtPath, srtContent, 'utf-8');
            else srtPath = undefined;

            if (script.includes('[TECH_START]')) {
                const words = script.split(/\s+/);
                const techStartIndex = words.findIndex(w => w.includes('[TECH_START]'));
                const techEndIndex = words.findIndex(w => w.includes('[TECH_END]'));
                if (techStartIndex !== -1 && techEndIndex !== -1) {
                    const wordsPerSecond = words.length / totalDuration;
                    bRollTiming = { start: techStartIndex / wordsPerSecond, end: techEndIndex / wordsPerSecond };
                }
            }
        }

        const clipPaths = await this.renderImagePathClips(tempDir, imagePaths, totalDuration, projectId);
        const concatListPath = path.join(tempDir, 'concat_list.txt');
        fs.writeFileSync(concatListPath, clipPaths.map(p => `file '${p}'`).join('\n'));
const { filterComplex, videoLabel, audioLabel } = this.buildComplexFilter(srtPath, bgMusicPath, bRollPath, bRollTiming, maskPath);
const command = ffmpeg(concatListPath).inputOptions(['-f concat', '-safe 0']).input(audioPath);
if (bgMusicPath) command.input(bgMusicPath);
if (bRollPath) command.input(bRollPath);

// Injetando a Máscara/Logo (com loop se for GIF)
if (maskPath) {
    if (maskPath.endsWith('.gif')) {
        command.input(maskPath).inputOptions(['-ignore_loop 0']); // Loop infinito para o GIF
    } else {
        command.input(maskPath);
    }
}

if (filterComplex.length > 0) command.complexFilter(filterComplex);

        const outputOptions = ['-c:v libx264', '-preset superfast', '-pix_fmt yuv420p', '-shortest', '-threads 2'];
        if (filterComplex.length > 0) outputOptions.push(`-map ${videoLabel}`, `-map ${audioLabel}`);
        else outputOptions.push('-map 0:v', '-map 1:a');

        const ffmpegLogPath = path.join(tempDir, 'ffmpeg.log');
        let lastProgressUpdate = 0;
        let settled = false;
        const timeout = setTimeout(async () => {
          if (settled) return;
          const message = `FFmpeg render timed out after ${Math.round(RENDER_TIMEOUT_MS / 60000)} minutes`;
          this.logger.error(`🚨 ${message} for ${projectId}`);
          try { command.kill('SIGKILL'); } catch {}
          if (projectId !== 'dev-session') {
            await this.projectsService.updateStatus(projectId, 'error', videoUrl, message);
            await this.updateRenderState(projectId, {
              stage: 'failed',
              progress: 0,
              error: message,
              logPath: ffmpegLogPath,
            });
          }
          reject(new Error(message));
        }, RENDER_TIMEOUT_MS);

        await this.updateRenderState(projectId, {
          stage: 'ffmpeg_render',
          progress: 50,
          duration: totalDuration,
          logPath: ffmpegLogPath,
        });

        command.outputOptions(outputOptions)
          .on('stderr', (line) => {
            try { fs.appendFileSync(ffmpegLogPath, `${line}\n`); } catch {}
          })
          .on('progress', (progress) => {
            const now = Date.now();
            if (now - lastProgressUpdate < 2000) return;
            lastProgressUpdate = now;
            const percent = typeof progress.percent === 'number'
              ? Math.min(98, Math.max(50, Math.round(50 + progress.percent * 0.48)))
              : 50;
            this.updateRenderState(projectId, {
              stage: 'ffmpeg_render',
              progress: percent,
              currentFrame: progress.frames ?? null,
              timemark: progress.timemark ?? null,
              duration: totalDuration,
              logPath: ffmpegLogPath,
            });
            this.videoGateway.broadcastProgress(projectId, percent, 'ffmpeg_render');
          })
          .on('end', async () => {
            settled = true;
            clearTimeout(timeout);
            if (projectId !== 'dev-session') {
              await this.projectsService.updateStatus(projectId, 'completed', videoUrl);
              await this.updateRenderState(projectId, {
                stage: 'completed',
                progress: 100,
                currentFrame: null,
                videoUrl,
                completedAt: new Date().toISOString(),
                logPath: ffmpegLogPath,
              });
            }
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
            resolve(videoUrl);
          })
          .on('error', async (err) => {
             settled = true;
             clearTimeout(timeout);
             this.logger.error(`🚨 FFmpeg Task Error: ${err.message}`);
             if (projectId !== 'dev-session') {
               await this.projectsService.updateStatus(projectId, 'error', videoUrl, err.message);
               await this.updateRenderState(projectId, {
                 stage: 'failed',
                 progress: 0,
                 error: err.message,
                 logPath: ffmpegLogPath,
               });
             }
             reject(err);
          });

        if (signal) {
          signal.addEventListener('abort', () => {
            command.kill('SIGKILL');
            reject(new Error('Job aborted by BullMQ'));
          });
        }
        command.save(finalPath);
      } catch (error) {
        this.logger.error(`🚨 processAssembly Critical Error: ${error.message}`);
        if (projectId !== 'dev-session') {
          await this.projectsService.updateStatus(projectId, 'error', videoUrl, error.message);
          await this.updateRenderState(projectId, {
            stage: 'failed',
            progress: 0,
            error: error.message,
          });
        }
        reject(error);
      }
    });
  }

  async assembleResearchVideo(projectId: string): Promise<string> {
    const project = await this.projectsService.findOne(projectId);
    const audioPath = path.join(process.cwd(), 'public', project.videoPath); 
    if (!fs.existsSync(audioPath)) throw new BadRequestException('Research audio file not found on disk.');
    const prompts = project.metadata?.storyboardPrompts;
    if (!prompts || prompts.length === 0) throw new BadRequestException('Storyboard prompts not found.');

    this.logger.log(`🎬 Enviando montagem de vídeo factual para a fila: ${projectId}`);
    const tempRoot = path.join(process.cwd(), 'temp');
    const jobId = Date.now().toString();
    const jobDir = path.join(tempRoot, `research_queue_${jobId}`);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

    const processResearchTask = async () => {
      try {
        const imageUrls = await this.aiService.generateImages(prompts);
        const imagePaths: string[] = [];
        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            const buffer = url.startsWith('data:image') 
              ? Buffer.from(url.split(',')[1], 'base64')
              : Buffer.from(await (await fetch(url)).arrayBuffer());
            const imgPath = path.join(jobDir, `image_${i}.png`);
            fs.writeFileSync(imgPath, buffer);
            imagePaths.push(imgPath);
        }
        await this.renderQueue.add('assemble', {
            audioPath, imagePaths, inputDuration: 0, script: project.script || undefined,
            externalTempDir: jobDir, projectId
        }, { attempts: 3, removeOnComplete: true });
        this.logger.log(`✅ Job factual adicionado à fila para ${projectId}`);
      } catch (err) {
        this.logger.error(`🚨 Falha na preparação factual: ${err.message}`);
      }
    };
    processResearchTask();
    return "Job sent to queue";
  }

  async generateVideo(projectId: string, theme: string = 'yellow_punch'): Promise<any> {
    const project = await this.projectsService.findOne(projectId);
    await this.projectsService.updateStatus(projectId, 'processing');
    return { status: 'done', videoPath: project.videoPath };
  }

  async getStatus(projectId: string): Promise<any> {
    const project = await this.projectsService.findOne(projectId);
    const render = project.metadata?.render || {};
    const statusAgeMs = Date.now() - new Date(project.updatedAt).getTime();
    const isStale = ['queued', 'processing'].includes(project.status as string)
      && statusAgeMs > RENDER_TIMEOUT_MS
      && render.stage !== 'completed'
      && render.stage !== 'failed';
    const staleMessage = `Render exceeded ${Math.round(RENDER_TIMEOUT_MS / 60000)} minutes without completion. Submit again with the current build to receive detailed progress.`;

    if (isStale && !project.error) {
      await this.projectsService.updateStatus(projectId, 'error', project.videoPath, staleMessage);
    }

    return { 
      status: isStale ? 'failed' : project.status, 
      progress: isStale ? 0 : render.progress ?? null,
      stage: isStale ? 'stale_timeout' : render.stage ?? project.status,
      currentFrame: render.currentFrame ?? null,
      currentClip: render.currentClip ?? null,
      totalClips: render.totalClips ?? null,
      duration: render.duration ?? null,
      updatedAt: render.updatedAt ?? project.updatedAt,
      videoUrl: project.videoPath, // HOMES Engine espera videoUrl
      videoPath: project.videoPath, 
      error: isStale ? (project.error || staleMessage) : project.error,
      render
    };
  }

  async getMusicList(): Promise<string[]> {
    const musicDir = path.join(process.cwd(), 'data/music');
    if (!fs.existsSync(musicDir)) return [];
    
    return fs.readdirSync(musicDir).filter(file => 
      ['.mp3', '.wav', '.m4a'].includes(path.extname(file).toLowerCase())
    );
  }
}
