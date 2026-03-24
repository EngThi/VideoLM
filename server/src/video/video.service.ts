import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
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
  ) {}

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
    
    const cmd = `ffmpeg -y -loop 1 -i "${imagePath}" -vf "scale=1920:-2,${finalZoomCmd},fade=t=in:st=0:d=0.5,fade=t=out:st=${outputDuration-0.5}:d=0.5" -c:v libx264 -t ${outputDuration} -pix_fmt yuv420p -preset superfast "${outputPath}"`;
    
    await execAsync(cmd);
  }

  private async renderAllClips(
    tempDir: string, 
    imageFiles: Express.Multer.File[], 
    totalDuration: number
  ): Promise<string[]> {
    const clipPaths: string[] = [];
    const durationPerImage = totalDuration / imageFiles.length;
    
    this.logger.log(`Rendering ${imageFiles.length} clips...`);
    this.videoGateway.broadcastProgress('dev-session', 5, 'rendering_clips');

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const imgPath = path.join(tempDir, `source_${i}.png`);
      const clipPath = path.join(tempDir, `clip_${i}.mp4`);
      const isLast = i === imageFiles.length - 1;

      fs.writeFileSync(imgPath, file.buffer);
      
      try {
          await this.createClip(imgPath, clipPath, durationPerImage, i, isLast);
          clipPaths.push(clipPath);
          const percent = 5 + Math.round((i / imageFiles.length) * 40);
          this.videoGateway.broadcastProgress('dev-session', percent, 'rendering_clips');
      } catch (e) {
          this.logger.error(`Failed to render clip ${i}:`, e);
          throw e; 
      }
    }
    
    return clipPaths;
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

  async assembleVideo(
    audioFile: Express.Multer.File,
    imageFiles: Express.Multer.File[],
    inputDuration: number,
    script?: string,
    bgMusicFile?: Express.Multer.File,
    externalTempDir?: string,
  ): Promise<PassThrough> {
    const tempDir = externalTempDir || path.join(process.cwd(), 'temp', `assemble_${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      // 1. Prepare Audio
      const audioPath = path.join(tempDir, 'audio.wav');
      fs.writeFileSync(audioPath, audioFile.buffer);

      let totalDuration = await this.getAudioDuration(audioPath);
      if (!totalDuration || isNaN(totalDuration) || totalDuration <= 0) {
          this.logger.warn(`Could not detect audio duration via ffprobe, using inputDuration: ${inputDuration}`);
          totalDuration = inputDuration;
      }
      this.logger.log(`Using Video Duration: ${totalDuration}s`);

      // 2. Prepare Subtitles (SRT)
      let srtPath: string | undefined;
      if (script && totalDuration > 0) {
          srtPath = path.join(tempDir, 'subtitles.srt');
          try {
              const srtContent = this.generateSrt(script, totalDuration);
              if (srtContent) {
                 fs.writeFileSync(srtPath, srtContent, 'utf-8');
              } else {
                 srtPath = undefined;
              }
          } catch (srtErr) {
              this.logger.error(`SRT Generation failed: ${srtErr.message}`);
              srtPath = undefined;
          }
      }

      // 3. Prepare Background Music
      let bgMusicPath: string | undefined;
      if (bgMusicFile) {
        bgMusicPath = path.join(tempDir, 'bg_music.mp3');
        fs.writeFileSync(bgMusicPath, bgMusicFile.buffer);
      }

      // 4. Render Scene Clips
      const clipPaths = await this.renderAllClips(tempDir, imageFiles, totalDuration);

      // 5. Create Concat File
      const concatListPath = path.join(tempDir, 'concat_list.txt');
      const concatListContent = clipPaths.map(p => `file '${p}'`).join('\n');
      fs.writeFileSync(concatListPath, concatListContent);

      // 6. Setup Final Ffmpeg Command
      const outStream = new PassThrough();
      let command = ffmpeg();

      command = command.input(concatListPath).inputOptions(['-f concat', '-safe 0']);
      command = command.input(audioPath);
      if (bgMusicPath) {
        command = command.input(bgMusicPath);
      }

      const { filterComplex, videoLabel, audioLabel } = this.buildComplexFilter(srtPath, bgMusicPath);

      if (filterComplex.length > 0) {
          command.complexFilter(filterComplex);
      }

      const outputOptions = [
          '-c:v libx264',
          '-preset superfast',
          '-pix_fmt yuv420p',
          '-movflags frag_keyframe+empty_moov',
          '-shortest'
      ];
      
      if (filterComplex.length > 0) {
           outputOptions.push(`-map ${videoLabel}`);
           outputOptions.push(`-map ${audioLabel}`);
      } else {
           outputOptions.push('-map 0:v'); 
           outputOptions.push('-map 1:a');
      }

      // 7. Execute Final Assembly
      command
        .outputOptions(outputOptions)
        .format('mp4')
        .on('start', (cmdLine) => {
            this.logger.log('Spawned Final Assembly Ffmpeg: ' + cmdLine);
            this.videoGateway.broadcastProgress('dev-session', 50, 'assembling');
        })
        .on('progress', () => {
             this.videoGateway.broadcastProgress('dev-session', 50 + Math.random() * 40, 'assembling');
        })
        .on('error', (err, stdout, stderr) => {
          this.logger.error(`Final Assembly Error: ${err.message}`, stderr);
          this.videoGateway.broadcastProgress('dev-session', 0, 'error');
          if (!outStream.destroyed) {
              outStream.emit('error', err);
              outStream.end();
          }
        })
        .on('end', () => {
          this.logger.log('✅ Video successfully assembled!');
          this.videoGateway.broadcastProgress('dev-session', 100, 'completed');
        })
        .pipe(outStream, { end: true });

      // Only auto-delete if it's a generated temp dir
      if (!externalTempDir) {
        setTimeout(() => {
          try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        }, 600000);
      }

      return outStream;

    } catch (error) {
      this.logger.error('Video assembly setup error', error.stack);
      try {
          const logPath = path.join(__dirname, '../../../server.log');
          fs.appendFileSync(logPath, `[VideoAssembly Error] ${error.message}\n${error.stack}\n\n`);
      } catch (e) {}
      throw error;
    }
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
