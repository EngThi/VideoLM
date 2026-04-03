import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegPath from 'ffmpeg-static';
import * as ffprobePath from 'ffprobe-static';
import { PassThrough } from 'stream';
import { ProjectsService } from '../projects/projects.service';
import { VideoGateway } from './video.gateway';

const execAsync = promisify(exec);

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private enginesPath = process.env.HOMES_ENGINE_PATH || '/path/to/HOMES-Engine';

  constructor(
    private projectsService: ProjectsService,
    private videoGateway: VideoGateway
  ) {
    // Configura fluent-ffmpeg para usar binários estáticos
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
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
    const finalZoomCmd = zoomCmd.replace(`d=${targetDurationFrames}`, `d=${finalZoomCmd}`);
    
    const ffmpegBin = ffmpegPath || 'ffmpeg';
    const cmd = `"${ffmpegBin}" -y -loop 1 -i "${imagePath}" -vf "scale=1920:-2,${finalZoomCmd},fade=t=in:st=0:d=0.5,fade=t=out:st=${outputDuration-0.5}:d=0.5" -c:v libx264 -t ${outputDuration} -pix_fmt yuv420p -preset ultrafast "${outputPath}"`;
    
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

  private async cleanupOldTempFolders() {
    try {
      const tempRoot = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempRoot)) return;

      const folders = fs.readdirSync(tempRoot);
      const now = Date.now();
      const expirationTime = 24 * 60 * 60 * 1000; // 24 hours

      for (const folder of folders) {
        const folderPath = path.join(tempRoot, folder);
        if (fs.lstatSync(folderPath).isDirectory() && folder.startsWith('assemble_')) {
          const stats = fs.statSync(folderPath);
          if (now - stats.mtimeMs > expirationTime) {
            this.logger.log(`Cleaning up old temp folder: ${folder}`);
            fs.rmSync(folderPath, { recursive: true, force: true });
          }
        }
      }
    } catch (e) {
      this.logger.error('Failed to cleanup old temp folders', e.stack);
    }
  }


  async assembleVideo(
    audioFile: Express.Multer.File,
    imageFiles: Express.Multer.File[],
    inputDuration: number,
    script?: string,
    bgMusicFile?: Express.Multer.File,
    externalTempDir?: string,
    projectId: string = 'dev-session',
  ): Promise<string> {
    await this.cleanupOldTempFolders();

    const tempDir = externalTempDir || path.join(process.cwd(), 'temp', `assemble_${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const finalFileName = `${projectId || 'dev'}_${Date.now()}.mp4`;
    const finalPath = path.join(process.cwd(), 'public/videos', finalFileName);
    const videoUrl = `/videos/${finalFileName}`;

    if (projectId !== 'dev-session') {
      await this.projectsService.updateStatus(projectId, 'processing');
    }

    const processTask = async () => {
      try {
        const audioPath = path.join(tempDir, 'audio.wav');
        fs.writeFileSync(audioPath, audioFile.buffer);

        let totalDuration = await this.getAudioDuration(audioPath);
        if (!totalDuration || isNaN(totalDuration) || totalDuration <= 0) {
            totalDuration = inputDuration;
        }

        let srtPath: string | undefined;
        if (script && totalDuration > 0) {
            srtPath = path.join(tempDir, 'subtitles.srt');
            const srtContent = this.generateSrt(script, totalDuration);
            if (srtContent) fs.writeFileSync(srtPath, srtContent, 'utf-8');
            else srtPath = undefined;
        }

        let bgMusicPath: string | undefined;
        if (bgMusicFile) {
          bgMusicPath = path.join(tempDir, 'bg_music.mp3');
          fs.writeFileSync(bgMusicPath, bgMusicFile.buffer);
        }

        const clipPaths = await this.renderAllClips(tempDir, imageFiles, totalDuration);

        const concatListPath = path.join(tempDir, 'concat_list.txt');
        const concatListContent = clipPaths.map(p => `file '${p}'`).join('\n');
        fs.writeFileSync(concatListPath, concatListContent);

        const { filterComplex, videoLabel, audioLabel } = this.buildComplexFilter(srtPath, bgMusicPath);

        const command = ffmpeg(concatListPath).inputOptions(['-f concat', '-safe 0']);
        command.input(audioPath);
        if (bgMusicPath) command.input(bgMusicPath);

        if (filterComplex.length > 0) command.complexFilter(filterComplex);

        const outputOptions = [
            '-c:v libx264',
            '-preset superfast',
            '-pix_fmt yuv420p',
            '-shortest'
        ];
        
        if (filterComplex.length > 0) {
             outputOptions.push(`-map ${videoLabel}`, `-map ${audioLabel}`);
        } else {
             outputOptions.push('-map 0:v', '-map 1:a');
        }

        command
          .outputOptions(outputOptions)
          .on('start', (cmd) => this.logger.log('FFmpeg Background Started'))
          .on('error', (err) => {
            this.logger.error('Background Assembly Error: ' + err.message);
            if (projectId !== 'dev-session') this.projectsService.updateStatus(projectId, 'error', undefined, err.message);
          })
          .on('end', () => {
            this.logger.log('✅ Video saved to: ' + finalPath);
            if (projectId !== 'dev-session') this.projectsService.updateStatus(projectId, 'completed', videoUrl);
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
          })
          .save(finalPath);

      } catch (error) {
        this.logger.error('Assembly setup error', error.stack);
        if (projectId !== 'dev-session') this.projectsService.updateStatus(projectId, 'error', undefined, error.message);
      }
    };

    processTask();
    return videoUrl;
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
