
import { Injectable } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';

// Set ffmpeg path
if (process.env.FFMPEG_PATH) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
} else {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
        ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    } catch (e) {
        console.warn("Could not load @ffmpeg-installer/ffmpeg, assuming native ffmpeg is available in PATH.");
    }
}

@Injectable()
export class VideoService {
  assembleVideo(audioFile: Express.Multer.File, imageFiles: Express.Multer.File[], duration?: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const tempDir = path.dirname(audioFile.path);
      const outputFilename = `output-${Date.now()}.mp4`;
      const outputPath = path.join(tempDir, outputFilename);
      const imagesListPath = path.join(tempDir, `images-${Date.now()}.txt`);

      // 1. Calculate duration per image
      let imageDuration = 10;
      if (duration && imageFiles.length > 0) {
          imageDuration = duration / imageFiles.length;
      }

      // 2. Create images.txt
      let concatFileContent = '';

      imageFiles.forEach((img) => {
          concatFileContent += `file '${img.filename}'\n`;
          concatFileContent += `duration ${imageDuration}\n`;
      });

      if (imageFiles.length > 0) {
        concatFileContent += `file '${imageFiles[imageFiles.length - 1].filename}'\n`;
      }

      fs.writeFileSync(imagesListPath, concatFileContent);

      // 3. Run FFmpeg
      ffmpeg()
        .input(imagesListPath)
        .inputOptions(['-f concat', '-safe 0'])
        .input(audioFile.path)
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-shortest',
          '-r 30'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('Spawned Ffmpeg with command: ' + commandLine);
        })
        .on('error', (err) => {
          console.error('An error occurred: ' + err.message);
          reject(err);
        })
        .on('end', () => {
          console.log('Processing finished !');
          // Cleanup list file
          try {
            fs.unlinkSync(imagesListPath);
          } catch(e) {
             console.error("Failed to delete images list", e);
          }
          resolve(outputPath);
        })
        .run();
    });
  }
}
