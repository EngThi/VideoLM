
import { Controller, Post, Get, Param, Body, UseInterceptors, UploadedFiles, Res } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VideoService } from './video.service';
import { Response } from 'express';

@Controller('api/video')
export class VideoController {
  constructor(private videoService: VideoService) {}

  @Post('assemble')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'audio', maxCount: 1 },
    { name: 'bgMusic', maxCount: 1 },
    { name: 'images', maxCount: 20 },
  ]))
  async assembleVideo(
    @UploadedFiles() files: { audio?: Express.Multer.File[], bgMusic?: Express.Multer.File[], images?: Express.Multer.File[] },
    @Body() body: { duration?: string; script?: string },
    @Res() res: Response
  ) {
    const videoStream = await this.videoService.assembleVideo(
      files.audio?.[0],
      files.images || [],
      parseFloat(body.duration || '0'),
      body.script,
      files.bgMusic?.[0]
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
