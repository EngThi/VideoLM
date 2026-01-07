
import { Injectable, BadRequestException } from '@nestjs/common';
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
  private enginesPath = process.env.HOMES_ENGINE_PATH || '/path/to/HOMES-Engine';

  constructor(
    private projectsService: ProjectsService,
    private videoGateway: VideoGateway
  ) {}

  private generateSrt(script: string, totalDuration: number): string {
    const lines = script.split(/[.!?]+(?=\s|$)/).filter(l => l.trim().length > 0);
    const durationPerLine = totalDuration / lines.length;
    
    let srtContent = '';
    
    lines.forEach((line, i) => {
      const start = i * durationPerLine;
      const end = (i + 1) * durationPerLine;
      
      const formatTime = (seconds: number) => {
        const date = new Date(0);
        date.setSeconds(seconds);
        const ms = Math.floor((seconds % 1) * 1000);
        return date.toISOString().substr(11, 8) + ',' + ms.toString().padStart(3, '0');
      };

      srtContent += `${i + 1}\n`;
      srtContent += `${formatTime(start)} --> ${formatTime(end)}\n`;
      srtContent += `${line.trim()}\n\n`;
    });

    return srtContent;
  }

  async assembleVideo(
    audioFile: Express.Multer.File,
    imageFiles: Express.Multer.File[],
    totalDuration: number,
    script?: string,
    bgMusicFile?: Express.Multer.File,
  ): Promise<PassThrough> {
    const tempDir = path.join(process.cwd(), 'temp', `assemble_${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      const audioPath = path.join(tempDir, 'audio.wav');
      fs.writeFileSync(audioPath, audioFile.buffer);

      let srtPath: string | undefined;
      if (script) {
          srtPath = path.join(tempDir, 'subtitles.srt');
          const srtContent = this.generateSrt(script, totalDuration);
          fs.writeFileSync(srtPath, srtContent, 'utf-8');
      }

      let bgMusicPath: string | undefined;
      if (bgMusicFile) {
        bgMusicPath = path.join(tempDir, 'bg_music.mp3');
        fs.writeFileSync(bgMusicPath, bgMusicFile.buffer);
      }

      const imagePaths: string[] = [];
      imageFiles.forEach((file, i) => {
        const imgPath = path.join(tempDir, `img_${i}.png`);
        fs.writeFileSync(imgPath, file.buffer);
        imagePaths.push(imgPath);
      });

      const outStream = new PassThrough();
      const durationPerImage = totalDuration / imagePaths.length;
      const fps = 25;
      const totalFrames = Math.ceil(totalDuration * fps);

      let command = ffmpeg();

      // Add image inputs
      imagePaths.forEach((img) => {
        command = command
          .input(img)
          .inputOptions([`-loop 1`, `-t ${durationPerImage}`]);
      });

      // Add audio inputs
      command = command.input(audioPath);
      if (bgMusicPath) {
        command = command.input(bgMusicPath);
      }

      // KEN BURNS ENGINE (Zoom & Pan)
      const filterComplex: any[] = [];
      const durationFrames = Math.ceil(durationPerImage * fps);
      
      imagePaths.forEach((_, i) => {
          // Ken Burns Effect Optimized (Safer version):
          // scale=1280:-2 ensures width is 1280 and height is proportional and even (required by x264)
          filterComplex.push({
              filter: 'scale',
              options: '1280:-2',
              inputs: `${i}:v`,
              outputs: `v_scaled${i}`
          });

          filterComplex.push({
              filter: 'zoompan',
              options: {
                  z: 'min(zoom+0.001,1.3)',
                  d: durationFrames,
                  x: 'iw/2-(iw/zoom/2)',
                  y: 'ih/2-(ih/zoom/2)',
                  s: '1280x720',
                  fps: fps
              },
              inputs: `v_scaled${i}`,
              outputs: `v${i}`
          });
      });

      // Concatenate processed video segments
      const concatInputs = imagePaths.map((_, i) => `[v${i}]`).join('');
      filterComplex.push({
        filter: 'concat',
        options: { n: imagePaths.length, v: 1, a: 0 },
        inputs: concatInputs,
        outputs: 'vconcat_raw',
      });

      // BURN-IN SUBTITLES
      let finalVideoLabel = 'vconcat_raw';
      if (srtPath) {
          const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
          filterComplex.push({
              filter: 'subtitles',
              options: {
                  filename: escapedSrtPath,
                  force_style: 'Alignment=2,OutlineColour=&H00000000,BorderStyle=3,Outline=1,Shadow=0,Fontname=Arial,FontSize=24,PrimaryColour=&H0000FFFF,Bold=1'
              },
              inputs: 'vconcat_raw',
              outputs: 'vsubtitled'
          });
          finalVideoLabel = 'vsubtitled';
      }

      // Audio mixing
      let finalAudioLabel = 'aconcat';
      if (bgMusicPath) {
          filterComplex.push({
              filter: 'volume',
              options: '0.2',
              inputs: [`${imagePaths.length + 1}:a`],
              outputs: 'bgmusic_low'
          });

          filterComplex.push({
            filter: 'amix',
            options: { inputs: 2, duration: 'first' },
            inputs: [`${imagePaths.length}:a`, 'bgmusic_low'],
            outputs: 'aconcat',
          });
      } else {
        filterComplex.push({
            filter: 'anull',
            inputs: [`${imagePaths.length}:a`],
            outputs: 'aconcat',
        });
      }

      command
        .complexFilter(filterComplex)
        .outputOptions([
          `-map [${finalVideoLabel}]`,
          `-map [${finalAudioLabel}]`,
          '-c:v libx264',
          '-preset superfast',
          '-threads 0',
          '-pix_fmt yuv420p',
          '-r 25',
          '-shortest',
          '-movflags frag_keyframe+empty_moov' // Important for streaming MP4
        ])
        .format('mp4')
        .on('start', (cmdLine) => {
            console.log('Spawned Ffmpeg with command: ' + cmdLine);
            this.videoGateway.broadcastProgress('dev-session', 1, 'started');
        })
        .on('progress', (progress) => {
            if (progress.frames) {
                const percent = Math.min(Math.round((progress.frames / totalFrames) * 100), 99);
                this.videoGateway.broadcastProgress('dev-session', percent, 'rendering');
            }
        })
        .on('error', (err, stdout, stderr) => {
          console.error('❌ FFmpeg error:', err.message);
          console.error('❌ FFmpeg stderr:', stderr);
          this.videoGateway.broadcastProgress('dev-session', 0, 'error');
          if (!outStream.destroyed) {
              outStream.emit('error', err);
              outStream.end();
          }
        })
        .on('end', () => {
          console.log('✅ FFmpeg finished assembly successfully');
          this.videoGateway.broadcastProgress('dev-session', 100, 'completed');
        })
        .pipe(outStream, { end: true });

      // Basic cleanup after some time
      setTimeout(() => {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
      }, 600000); // 10 minutes

      return outStream;
    } catch (error) {
      console.error('Video assembly setup error:', error);
      throw error;
    }
  }

  async generateVideo(
    projectId: string,
    theme: string = 'yellow_punch',
  ): Promise<{ status: string; videoPath?: string; error?: string }> {
    try {
      // Validar projeto
      const project = await this.projectsService.findOne(projectId);
      
      if (!project.script) {
        throw new BadRequestException('Project has no script');
      }

      // Atualizar status
      await this.projectsService.updateStatus(projectId, 'processing');

      // Criar arquivo temporário com script
      const scriptFile = path.join(this.enginesPath, 'scripts', `${projectId}.txt`);
      fs.writeFileSync(scriptFile, project.script, 'utf-8');

      // Executar HOMES-Engine
      const cmd = `cd ${this.enginesPath} && python main.py --script ${scriptFile} --theme ${theme}`;
      const { stdout, stderr } = await execAsync(cmd, { timeout: 600000 }); // 10 min timeout

      // Parse output (esperado: caminho do vídeo)
      const videoPath = stdout.trim();

      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found at ${videoPath}`);
      }

      // Atualizar status
      await this.projectsService.updateStatus(projectId, 'done', videoPath);

      return {
        status: 'done',
        videoPath,
      };
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      await this.projectsService.updateStatus(projectId, 'error', undefined, errorMsg);

      return {
        status: 'error',
        error: errorMsg,
      };
    }
  }

  async getStatus(projectId: string): Promise<any> {
    const project = await this.projectsService.findOne(projectId);
    return {
      status: project.status,
      videoPath: project.videoPath,
      error: project.error,
    };
  }
}
