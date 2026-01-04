
import { Controller, Post, UploadedFiles, UploadedFile, UseInterceptors, Body, Res, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { VideoService } from './video.service';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Controller('api')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('upload-assets')
  @UseInterceptors(FileInterceptor('zipFile', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const tempDir = path.join(__dirname, '../../../temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, tempDir);
      },
      filename: (req, file, cb) => {
        cb(null, `dev-assets-${Date.now()}.zip`);
      }
    })
  }))
  async uploadAssets(@UploadedFile() zipFile: Express.Multer.File, @Res() res: Response) {
      if (!zipFile) {
          throw new BadRequestException('No zip file provided');
      }

      console.log(`[Upload] Received asset zip: ${zipFile.path}`);

      // Target Directory: ProjectRoot/public/temp_assets/custom
      // Assuming server runs from server/dist/src/video or similar, we need to go up to root
      // Root is usually where package.json is.
      // Current __dirname in dist is usually .../server/dist/src/video
      const projectRoot = path.resolve(__dirname, '../../../../'); 
      const targetDir = path.join(projectRoot, 'public/temp_assets/custom');

      try {
          // 1. Clean target directory
          if (fs.existsSync(targetDir)) {
              fs.rmSync(targetDir, { recursive: true, force: true });
          }
          fs.mkdirSync(targetDir, { recursive: true });

          // 2. Unzip
          console.log(`[Upload] Extracting to ${targetDir}...`);
          await execAsync(`unzip -o "${zipFile.path}" -d "${targetDir}"`);

          // 3. Cleanup zip
          fs.unlinkSync(zipFile.path);

          return res.json({ success: true, path: '/temp_assets/custom' });

      } catch (error) {
          console.error("Asset extraction failed:", error);
          throw new InternalServerErrorException("Failed to unzip assets");
      }
  }

  @Post('assemble')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'audio', maxCount: 1 },
    { name: 'images' },
  ], {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const tempDir = path.join(__dirname, '../../../temp'); // Adjust path based on dist/src/...
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, tempDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
      }
    })
  }))
  async assemble(
    @UploadedFiles() files: { audio?: Express.Multer.File[], images?: Express.Multer.File[] },
    @Body('duration') durationStr: string,
    @Body('script') scriptText: string,
    @Res() res: Response
  ) {
    if (!files.audio || files.audio.length === 0) {
      throw new BadRequestException('Audio file is required');
    }
    if (!files.images || files.images.length === 0) {
      throw new BadRequestException('Image files are required');
    }

    console.log(`[Assemble] Received ${files.images.length} images and 1 audio file. Subtitles: ${!!scriptText}`);

    const audioFile = files.audio[0];
    const imageFiles = files.images;
    const duration = durationStr ? parseFloat(durationStr) : undefined;

    const filesToDelete: string[] = [audioFile.path, ...imageFiles.map(f => f.path)];

    try {
      const videoPath = await this.videoService.assembleVideo(audioFile, imageFiles, duration, scriptText);
      filesToDelete.push(videoPath);

      res.download(videoPath, 'output.mp4', (err) => {
        if (err) {
            console.error("Error sending file:", err);
            if (!res.headersSent) {
                res.status(500).send("Error downloading file");
            }
        }
        this.cleanupFiles(filesToDelete);
      });

    } catch (error) {
      console.error('Error in video assembly:', error);
      this.cleanupFiles(filesToDelete);
      throw new InternalServerErrorException('Failed to assemble video');
    }
  }

  private cleanupFiles(files: string[]) {
    files.forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          console.error(`Failed to delete file ${file}:`, err);
        }
      }
    });
  }
}
