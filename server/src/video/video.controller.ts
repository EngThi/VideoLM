
import { Controller, Post, UploadedFiles, UseInterceptors, Body, Res, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { VideoService } from './video.service';
import * as path from 'path';
import * as fs from 'fs';

@Controller('api')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

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
    @Res() res: Response
  ) {
    if (!files.audio || files.audio.length === 0) {
      throw new BadRequestException('Audio file is required');
    }
    if (!files.images || files.images.length === 0) {
      throw new BadRequestException('Image files are required');
    }

    const audioFile = files.audio[0];
    const imageFiles = files.images;
    const duration = durationStr ? parseFloat(durationStr) : undefined;

    const filesToDelete: string[] = [audioFile.path, ...imageFiles.map(f => f.path)];

    try {
      const videoPath = await this.videoService.assembleVideo(audioFile, imageFiles, duration);
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
