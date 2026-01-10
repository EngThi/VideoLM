
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
    const rawLines = script.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g) || [];
    const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);
    const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
    let srtContent = '';
    let currentTime = 0;
    lines.forEach((line, i) => {
      const weight = line.length / totalChars;
      const duration = weight * totalDuration;
      const start = currentTime;
      const end = currentTime + duration;
      currentTime = end;
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

  private getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        const duration = metadata.format.duration;
        if (!duration) return reject(new Error('Could not determine audio duration'));
        resolve(duration);
      });
    });
  }

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
    const zoomCmd = index % 2 === 0 
      ? `zoompan=z='min(zoom+0.0015,1.5)':d=${targetDurationFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720:fps=${fps}`
      : `zoompan=z='min(zoom+0.0015,1.5)':d=${targetDurationFrames}:x='if(eq(on,1),iw/2,x-1)':y='if(eq(on,1),ih/2,y)':s=1280x720:fps=${fps}`;
    const finalDurationFrames = Math.ceil(outputDuration * fps);
    const finalZoomCmd = zoomCmd.replace(`d=${targetDurationFrames}`, `d=${finalDurationFrames}`);
    const cmd = `ffmpeg -y -loop 1 -i "${imagePath}" -vf "scale=1920:-2,${finalZoomCmd},fade=t=in:st=0:d=0.5,fade=t=out:st=${outputDuration-0.5}:d=0.5" -c:v libx264 -t ${outputDuration} -pix_fmt yuv420p -preset superfast "${outputPath}"`;
    await execAsync(cmd);
  }

  async assembleVideo(
    audioFile: Express.Multer.File,
    imageFiles: Express.Multer.File[],
    inputDuration: number,
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

      const totalDuration = await this.getAudioDuration(audioPath);
      console.log(`Audio Duration detected: ${totalDuration}s (Input was: ${inputDuration}s)`);

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

      const clipPaths: string[] = [];
      const durationPerImage = totalDuration / imageFiles.length;
      
      console.log(`Rendering ${imageFiles.length} clips...`);
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
            console.error(`Failed to render clip ${i}:`, e);
            throw e; 
        }
      }

      const concatListPath = path.join(tempDir, 'concat_list.txt');
      const concatListContent = clipPaths.map(p => `file '${p}'`).join('\n');
      fs.writeFileSync(concatListPath, concatListContent);

      const outStream = new PassThrough();
      let command = ffmpeg();

      command = command.input(concatListPath).inputOptions(['-f concat', '-safe 0']);
      command = command.input(audioPath);
      if (bgMusicPath) {
        command = command.input(bgMusicPath);
      }

      const filterComplex: any[] = [];
      let videoLabel = '0:v';
      if (srtPath) {
          const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
          filterComplex.push({
              filter: 'subtitles',
              options: { filename: escapedSrtPath, force_style: 'Alignment=2,OutlineColour=&H00000000,BorderStyle=3,Outline=1,Shadow=0,Fontname=Arial,FontSize=24,PrimaryColour=&H0000FFFF,Bold=1' },
              inputs: '0:v',
              outputs: 'vsubtitled'
          });
          videoLabel = '[vsubtitled]';
      }

      let audioLabel = '1:a';
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

      command
        .outputOptions(outputOptions)
        .format('mp4')
        .on('start', (cmdLine) => {
            console.log('Spawned Final Assembly Ffmpeg: ' + cmdLine);
            this.videoGateway.broadcastProgress('dev-session', 50, 'assembling');
        })
        .on('progress', (progress) => {
             this.videoGateway.broadcastProgress('dev-session', 50 + Math.random() * 40, 'assembling');
        })
        .on('error', (err, stdout, stderr) => {
          console.error('❌ Final Assembly Error:', err.message);
          console.error('❌ Stderr:', stderr);
          this.videoGateway.broadcastProgress('dev-session', 0, 'error');
          if (!outStream.destroyed) {
              outStream.emit('error', err);
              outStream.end();
          }
        })
        .on('end', () => {
          console.log('✅ Video successfully assembled!');
          this.videoGateway.broadcastProgress('dev-session', 100, 'completed');
        })
        .pipe(outStream, { end: true });

      setTimeout(() => {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
      }, 600000);

      return outStream;
    } catch (error) {
      console.error('Video assembly setup error:', error);
      if (error instanceof Error) {
        console.error(error.stack);
        try {
            const logPath = path.join(__dirname, '../../../server.log');
            fs.appendFileSync(logPath, `[VideoAssembly Error] ${error.message}\n${error.stack}\n\n`);
        } catch (e) {}
      }
      throw error;
    }
  }

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
      const { stdout, stderr } = await execAsync(cmd, { timeout: 600000 });
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
    if (!fs.existsSync(musicDir)) {
      return [];
    }
    // Note: The test used readdir, but readdirSync is used here. This is fine.
    return fs.readdirSync(musicDir).filter(file => 
      ['.mp3', '.wav', '.m4a'].includes(path.extname(file).toLowerCase())
    );
  }
}
