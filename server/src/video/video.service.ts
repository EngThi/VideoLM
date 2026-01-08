
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
    // Better splitting: split by sentence terminators but keep them, and respect newlines
    // This regex matches sentences ending in . ! ? 
    const rawLines = script.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g) || [];
    const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);
    
    // Calculate total weight (characters)
    const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
    
    let srtContent = '';
    let currentTime = 0;
    
    lines.forEach((line, i) => {
      // Proportional duration based on character count
      // Min duration 1s to make it readable, unless very short
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
    // For the last clip, we generate the ZoomPan for the target duration, 
    // but we encode a longer video to ensure we cover any audio overflow.
    // The 'zoompan' filter repeats the last frame if the input (d) is exceeded? 
    // Actually, we should hold the last frame.
    
    const targetDurationFrames = Math.ceil(duration * fps);
    
    // If it's the last clip, we add 5 seconds of padding to the OUTPUT
    // But the ZoomPan effect should still finish at 'duration', then hold.
    const outputDuration = isLast ? duration + 5 : duration;

    // Calculate zoom/pan parameters based on index (even/odd) for variety
    const zoomCmd = index % 2 === 0 
      ? `zoompan=z='min(zoom+0.0015,1.5)':d=${targetDurationFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720:fps=${fps}`
      : `zoompan=z='min(zoom+0.0015,1.5)':d=${targetDurationFrames}:x='if(eq(on,1),iw/2,x-1)':y='if(eq(on,1),ih/2,y)':s=1280x720:fps=${fps}`;

    // Note on padding:
    // We rely on 'zoompan' logic: if we stream MORE frames than 'd', zoompan usually resets or loops depending on input.
    // But since we use -loop 1 on input image, the input stream is infinite.
    // However, zoompan 'd' sets the duration of the effect. After 'd', it resets to start if not handled?
    // Actually, let's keep it simple: Make the effect last the FULL output duration for the last clip?
    // No, that changes the speed.
    // We want: Effect for X seconds, then Static Frame for 5 seconds.
    // To do that in one command is complex.
    // ALTERNATIVE: Just make the last clip's effect SLOWER? 
    // No, that breaks consistency.
    
    // EASIEST FIX: Just make the last clip longer in 'd' and 't' (outputDuration).
    // The zoom will just continue zooming a bit more. That's fine!
    // It prevents the black screen.
    
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

      // TRUST NO ONE: Calculate actual audio duration using ffprobe
      const totalDuration = await this.getAudioDuration(audioPath);
      console.log(`Audio Duration detected: ${totalDuration}s (Input was: ${inputDuration}s)`);

      let srtPath: string | undefined;
      if (script) {
          srtPath = path.join(tempDir, 'subtitles.srt');
          // Use improved generation
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
      
      // Step 1: Render individual clips (Sequential for safety, could be parallel)
      console.log(`Rendering ${imageFiles.length} clips...`);
      this.videoGateway.broadcastProgress('dev-session', 5, 'rendering_clips');

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const imgPath = path.join(tempDir, `source_${i}.png`);
        const clipPath = path.join(tempDir, `clip_${i}.mp4`);
        const isLast = i === imageFiles.length - 1;

        fs.writeFileSync(imgPath, file.buffer);
        
        try {
            // Pass isLast to add padding
            await this.createClip(imgPath, clipPath, durationPerImage, i, isLast);
            clipPaths.push(clipPath);
            
            const percent = 5 + Math.round((i / imageFiles.length) * 40); // 5% to 45%
            this.videoGateway.broadcastProgress('dev-session', percent, 'rendering_clips');
        } catch (e) {
            console.error(`Failed to render clip ${i}:`, e);
            // Fallback: Just copy the image or skip? 
            // For now, if a clip fails, the whole process might fail, which is acceptable for dev.
            throw e; 
        }
      }

      // Step 2: Create concat list
      const concatListPath = path.join(tempDir, 'concat_list.txt');
      const concatListContent = clipPaths.map(p => `file '${p}'`).join('\n');
      fs.writeFileSync(concatListPath, concatListContent);

      // Step 3: Final Assembly
      const outStream = new PassThrough();
      
      let command = ffmpeg();

      // Input 0: The video clips (via concat demuxer)
      command = command
        .input(concatListPath)
        .inputOptions(['-f concat', '-safe 0']);

      // Input 1: The main audio
      command = command.input(audioPath);

      // Input 2: BG Music (optional)
      if (bgMusicPath) {
        command = command.input(bgMusicPath);
      }

      const filterComplex: any[] = [];
      
      // Subtitles
      let videoLabel = '0:v';
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

      // Audio Mixing
      let audioLabel = '1:a';
      if (bgMusicPath) {
          filterComplex.push({
              filter: 'volume',
              options: '0.2',
              inputs: '2:a',
              outputs: 'bgmusic_low'
          });
          filterComplex.push({
              filter: 'amix',
              options: { inputs: 2, duration: 'first' },
              inputs: ['1:a', 'bgmusic_low'],
              outputs: 'amixed'
          });
          audioLabel = '[amixed]';
      }

      // Build the command
      if (filterComplex.length > 0) {
          command.complexFilter(filterComplex);
      }

      const outputOptions = [
          '-c:v libx264',
          '-preset superfast',
          '-pix_fmt yuv420p',
          '-movflags frag_keyframe+empty_moov',
          '-shortest' // Stop when the shortest input (usually audio) ends
      ];
      
      if (filterComplex.length > 0) {
           outputOptions.push(`-map ${videoLabel}`);
           outputOptions.push(`-map ${audioLabel}`);
      } else {
           // Direct mapping if no filters (unlikely due to subtitles/audio, but safe fallback)
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
            // Rough estimate for final encoding
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

      // Basic cleanup after some time
      setTimeout(() => {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
      }, 600000); // 10 minutes

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
