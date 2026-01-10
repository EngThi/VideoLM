
import { Controller, Post, Get, Param, Body, UseInterceptors, UploadedFiles, Res } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VideoService } from './video.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('api/video')
export class VideoController {
  constructor(private videoService: VideoService) {}

  @Get('music')
  async getMusicList() {
    return this.videoService.getMusicList();
  }

  @Post('assemble')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'audio', maxCount: 1 },
    { name: 'bgMusic', maxCount: 1 },
    { name: 'images', maxCount: 20 },
  ]))
  async assembleVideo(
    @UploadedFiles() files: { audio?: Express.Multer.File[], bgMusic?: Express.Multer.File[], images?: Express.Multer.File[] },
    @Body() body: { duration?: string; script?: string; bgMusicId?: string },
    @Res() res: Response
  ) {
    let bgMusicFile = files.bgMusic?.[0];

    // If no file uploaded but bgMusicId provided, try to load from local storage
    if (!bgMusicFile && body.bgMusicId) {
      const musicPath = path.join(process.cwd(), 'data/music', body.bgMusicId);
      if (fs.existsSync(musicPath)) {
        const buffer = fs.readFileSync(musicPath);
        bgMusicFile = {
          buffer,
          originalname: body.bgMusicId,
          mimetype: 'audio/mpeg',
          fieldname: 'bgMusic',
          encoding: '7bit',
          size: buffer.length,
          stream: null as any,
          destination: '',
          filename: '',
          path: ''
        };
      }
    }

    const videoStream = await this.videoService.assembleVideo(
      files.audio?.[0],
      files.images || [],
      parseFloat(body.duration || '0'),
      body.script,
      bgMusicFile
    );

    res.set({
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'attachment; filename="video.mp4"',
    });

    videoStream.pipe(res);
  }

  @Post(':projectId/generate')
  generateVideo(
    @Param('projectId') projectId: string,
    @Body() { theme }: { theme?: string },
  ) {
    return this.videoService.generateVideo(projectId, theme);
  }

  @Get(':projectId/status')
  getStatus(@Param('projectId') projectId: string) {
    return this.videoService.getStatus(projectId);
  }
}
