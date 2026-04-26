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
        .outputOptions(['-c:v libx264', '-t', duration.toFixed(3), '-pix_fmt yuv420p'])
        .on('end', () => resolve())
        .on('error', (err) => {
            this.logger.error(`❌ FFmpeg createClip fail: ${err.message}`);
            reject(err);
        })
        .save(outputPath);
    });
  }

  private buildComplexFilter(srtPath?: string, bgMusicPath?: string, bRollPath?: string, bRollTiming?: { start: number; end: number }) {
    const filterComplex: any[] = [];
    let videoLabel = '0:v';
    let audioLabel = '1:a';

    // Calcula índices de entrada dinamicamente
    let nextInputIndex = 2; // 0: video, 1: audio
    if (bgMusicPath) nextInputIndex++;
    const bRollInputIndex = nextInputIndex;

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

    // 2. B-Roll Infográfico (Absolute Cinema 200%)
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
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
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

    if (projectId !== 'dev-session') await this.projectsService.updateStatus(projectId, 'processing');

    return new Promise(async (resolve, reject) => {
      try {
        let totalDuration = await this.getAudioDuration(audioPath);
        if (!totalDuration || isNaN(totalDuration) || totalDuration <= 0) {
            totalDuration = inputDuration > 0 ? inputDuration : 10; // Mínimo de 10s
        }
        this.logger.log(`📏 Total Video Duration: ${totalDuration.toFixed(2)}s`);

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

        const pseudoImageFiles: any[] = imagePaths.map(p => ({ buffer: fs.readFileSync(p), originalname: p }));
        const clipPaths = await this.renderAllClips(tempDir, pseudoImageFiles, totalDuration);
        const concatListPath = path.join(tempDir, 'concat_list.txt');
        fs.writeFileSync(concatListPath, clipPaths.map(p => `file '${p}'`).join('\n'));

        const { filterComplex, videoLabel, audioLabel } = this.buildComplexFilter(srtPath, bgMusicPath, bRollPath, bRollTiming);
        const command = ffmpeg(concatListPath).inputOptions(['-f concat', '-safe 0']).input(audioPath);
        if (bgMusicPath) command.input(bgMusicPath);
        if (bRollPath) command.input(bRollPath);
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
             this.logger.error(`🚨 FFmpeg Task Error: ${err.message}`);
             if (projectId !== 'dev-session') this.projectsService.updateStatus(projectId, 'error', undefined, err.message);
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
