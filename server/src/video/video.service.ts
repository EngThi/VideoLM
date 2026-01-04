
import { Injectable } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';

// Set ffmpeg path
let ffmpegPath = process.env.FFMPEG_PATH;
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
} else {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
        ffmpegPath = ffmpegInstaller.path;
        ffmpeg.setFfmpegPath(ffmpegPath);
    } catch (e) {
        console.warn("Could not load @ffmpeg-installer/ffmpeg, assuming native ffmpeg is available in PATH.");
        ffmpegPath = 'ffmpeg';
    }
}
// Attempt to set ffprobe path (assuming system install in this environment)
try {
    ffmpeg.setFfprobePath('ffprobe');
} catch (e) {
    console.warn("Could not set ffprobe path.");
}

console.log(`[VideoService] Using FFmpeg path: ${ffmpegPath}`);

@Injectable()
export class VideoService {
  private generateSrt(text: string, totalDuration: number): string {
    const words = text.split(/\s+/);
    const wordsPerSrt = 5; // Group 5 words per subtitle entry
    const groups = [];
    
    for (let i = 0; i < words.length; i += wordsPerSrt) {
        groups.push(words.slice(i, i + wordsPerSrt).join(' '));
    }

    const durationPerGroup = totalDuration / groups.length;
    let srtContent = '';

    groups.forEach((group, index) => {
        const start = index * durationPerGroup;
        const end = (index + 1) * durationPerGroup;

        const formatTime = (seconds: number) => {
            const date = new Date(0);
            date.setSeconds(seconds);
            const ms = Math.floor((seconds % 1) * 1000);
            return date.toISOString().substr(11, 8) + ',' + ms.toString().padStart(3, '0');
        };

        srtContent += `${index + 1}\n`;
        srtContent += `${formatTime(start)} --> ${formatTime(end)}\n`;
        srtContent += `${group}\n\n`;
    });

    return srtContent;
  }

  async assembleVideo(audioFile: Express.Multer.File, imageFiles: Express.Multer.File[], duration?: number, scriptText?: string, bgMusicFile?: Express.Multer.File): Promise<string> {
    console.log(`[VideoService] Starting assembly with ${imageFiles.length} images, audio: ${audioFile.path}, BG Music: ${!!bgMusicFile}`);
    
    const tempDir = path.dirname(audioFile.path);
    const outputFilename = `output-${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFilename);
    let srtPath: string | null = null;
    let finalAudioInput = audioFile.path;

    // ... (rest of duration detection)
    // Prefer actual audio duration to ensure images are distributed evenly over the audio.
    let totalDuration = duration || 30;
    
    try {
        const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
            ffmpeg.ffprobe(audioFile.path, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
        if (metadata.format && metadata.format.duration) {
            totalDuration = metadata.format.duration;
            console.log(`[VideoService] Probed audio duration: ${totalDuration}s (Overriding provided: ${duration})`);
        }
    } catch (e) {
        console.warn(`[VideoService] Failed to probe audio duration: ${e.message}.`);
        
        // Intelligent Fallback:
        // If probing failed, and we have a "suspiciously default" long duration (like 480s) 
        // with a small number of images, it's likely a config error (Dev Mode bug).
        // We revert to a safe estimate: ~5-10 seconds per image.
        if (totalDuration > 300 && imageFiles.length < 20) {
            const safeDuration = imageFiles.length * 5; // 5 seconds per image
            console.warn(`[VideoService] Suspicious duration (${totalDuration}s) with low image count. Fallback to safe estimate: ${safeDuration}s`);
            totalDuration = safeDuration;
        } else {
             console.warn(`[VideoService] Using provided/default duration: ${totalDuration}s`);
        }
    }

    // 2. Calculate duration per image
    const imageDuration = totalDuration / imageFiles.length;
    const fps = 30;

    console.log(`[VideoService] Final configuration: Duration=${totalDuration}s, Images=${imageFiles.length}, Per Image=${imageDuration}s`);
    imageFiles.forEach((f, idx) => console.log(`  - Image ${idx}: ${f.originalname} (${f.size} bytes)`));

    return new Promise((resolve, reject) => {
      // 3. Build FFmpeg command
      let command = ffmpeg();
      const complexFilter = [];
      const videoOutputs = [];


      // Add image inputs
      imageFiles.forEach((img) => {
        command = command.input(img.path).inputOptions(['-loop 1', '-framerate 30', `-t ${imageDuration}`]);
      });

      // Add audio input
      command = command.input(audioFile.path);
      
      const narrationIdx = imageFiles.length;
      let audioMap = `${narrationIdx}:a`;

      if (bgMusicFile) {
          command = command.input(bgMusicFile.path);
          const bgMusicIdx = imageFiles.length + 1;
          
          // Mix narration and background music
          // Narration (volume=1.0), BG Music (volume=0.2)
          complexFilter.push({
              filter: 'volume',
              options: '1.0',
              inputs: `${narrationIdx}:a`,
              outputs: 'voice'
          });
          complexFilter.push({
              filter: 'volume',
              options: '0.15', // Lower background music volume
              inputs: `${bgMusicIdx}:a`,
              outputs: 'bgm'
          });
          complexFilter.push({
              filter: 'amix',
              options: { inputs: 2, duration: 'first' },
              inputs: ['voice', 'bgm'],
              outputs: 'mixed_audio'
          });
          audioMap = '[mixed_audio]';
      }

      // 3. Create complex filter for Ken Burns effect

      imageFiles.forEach((_, i) => {
        const inputLabel = `${i}:v`;
        const scaledLabel = `scaled${i}`;
        const croppedLabel = `cropped${i}`;
        const zoomRawLabel = `z${i}_raw`; // Intermediate label
        const zoomLabel = `z${i}`; // Final normalized label
        videoOutputs.push(zoomLabel);

        const frames = Math.ceil(imageDuration * fps);
        const isZoomIn = i % 2 === 0;
        const zoomExpr = isZoomIn ? 'min(zoom+0.0015,1.5)' : 'max(1.5-0.0015*on,1.0)';

        // Scale
        complexFilter.push({
          filter: 'scale',
          options: '1280:720:force_original_aspect_ratio=increase',
          inputs: inputLabel,
          outputs: scaledLabel
        });

        // Crop
        complexFilter.push({
          filter: 'crop',
          options: '1280:720',
          inputs: scaledLabel,
          outputs: croppedLabel
        });

        // ZoomPan
        complexFilter.push({
          filter: 'zoompan',
          options: {
            z: zoomExpr,
            d: frames,
            s: '1280x720',
            x: 'iw/2-(iw/zoom/2)',
            y: 'ih/2-(ih/zoom/2)',
            fps: fps
          },
          inputs: croppedLabel,
          outputs: zoomRawLabel
        });

        // Normalize SAR and Pixel Format before Concat
        // This prevents "Error reinitializing filters" if inputs differ
        complexFilter.push({
            filter: 'setsar',
            options: '1',
            inputs: zoomRawLabel,
            outputs: `${zoomRawLabel}_sar`
        });

        // Reset PTS to ensure concat works correctly
        complexFilter.push({
            filter: 'setpts',
            options: 'PTS-STARTPTS',
            inputs: `${zoomRawLabel}_sar`,
            outputs: `${zoomRawLabel}_pts`
        });

        complexFilter.push({
            filter: 'format',
            options: 'yuv420p',
            inputs: `${zoomRawLabel}_pts`,
            outputs: zoomLabel
        });
      });

      // Concat all images
      complexFilter.push({
        filter: 'concat',
        options: {
          n: imageFiles.length,
          v: 1,
          a: 0
        },
        inputs: videoOutputs,
        outputs: 'outv'
      });

      // Handle Subtitles
      let videoMap = '[outv]';
      if (scriptText) {
          try {
              const srtContent = this.generateSrt(scriptText, totalDuration);
              srtPath = path.join(tempDir, `subtitles-${Date.now()}.srt`);
              fs.writeFileSync(srtPath, srtContent);
              console.log(`[VideoService] Subtitles generated at: ${srtPath}`);

              // Burn-in subtitles
              // Note: subtitles filter in ffmpeg needs escaped path on Windows, but on Linux/Docker it's usually fine.
              // We use a separate filter step for subtitles to keep it clean.
              complexFilter.push({
                  filter: 'subtitles',
                  options: {
                      filename: srtPath,
                      force_style: 'Alignment=2,FontSize=24,PrimaryColour=&H00FFFF,OutlineColour=&H000000,BorderStyle=1,Outline=2'
                  },
                  inputs: 'outv',
                  outputs: 'subs'
              });
              videoMap = '[subs]';
          } catch (e) {
              console.error(`[VideoService] Failed to generate/apply subtitles: ${e.message}`);
          }
      }

      command
        .complexFilter(complexFilter)
        .outputOptions([
          `-map ${videoMap}`,
          `-map ${audioMap}`,
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-shortest',
          '-r 30'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('Spawned FFmpeg with effects: ' + commandLine);
        })
        .on('error', (err) => {
          console.error('An error occurred: ' + err.message);
          if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
          reject(err);
        })
        .on('end', () => {
          console.log('Processing finished !');
          if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
          resolve(outputPath);
        })
        .run();
    });
  }
}
