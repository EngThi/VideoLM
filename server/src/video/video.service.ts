
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
        ffmpegPath = 'ffmpeg (system)';
    }
}
console.log(`[VideoService] Using FFmpeg path: ${ffmpegPath}`);

@Injectable()
export class VideoService {
  assembleVideo(audioFile: Express.Multer.File, imageFiles: Express.Multer.File[], duration?: number): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`[VideoService] Starting assembly with ${imageFiles.length} images and audio: ${audioFile.path}`);
      
      const tempDir = path.dirname(audioFile.path);
      const outputFilename = `output-${Date.now()}.mp4`;
      const outputPath = path.join(tempDir, outputFilename);

      // 1. Calculate duration per image
      let totalDuration = duration || 30; // Default to 30s if not provided
      const imageDuration = totalDuration / imageFiles.length;
      const fps = 30;

      // 2. Build FFmpeg command
      let command = ffmpeg();

      console.log(`[VideoService] Duration: ${totalDuration}s, Images: ${imageFiles.length}, Per Image: ${imageDuration}s`);

      // Add image inputs
      imageFiles.forEach((img) => {
        command = command.input(img.path).inputOptions(['-loop 1', '-framerate 30', `-t ${imageDuration}`]);
      });

      // Add audio input
      command = command.input(audioFile.path);

      // 3. Create complex filter for Ken Burns effect
      const complexFilter = [];
      const videoOutputs = [];

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

        complexFilter.push({
            filter: 'format',
            options: 'yuv420p',
            inputs: `${zoomRawLabel}_sar`,
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

      command
        .complexFilter(complexFilter)
        .outputOptions([
          '-map [outv]',
          `-map ${imageFiles.length}:a`,
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-shortest',
          '-r 30'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('Spawned FFmpeg with Ken Burns effect: ' + commandLine);
        })
        .on('error', (err) => {
          console.error('An error occurred: ' + err.message);
          reject(err);
        })
        .on('end', () => {
          console.log('Processing finished !');
          resolve(outputPath);
        })
        .run();
    });
  }
}
