
import { Controller, Post, Get, Param, Body, UseInterceptors, UploadedFiles, Res, BadRequestException, UseGuards } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VideoService } from './video.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

  @UseGuards(JwtAuthGuard)
  @Post('assemble')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'audio', maxCount: 1 },
    { name: 'bgMusic', maxCount: 1 },
    { name: 'images', maxCount: 100 },
  ], {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB per file
      fieldSize: 100 * 1024 * 1024, // 100MB per field
    }
  }))
  async assembleVideo(
    @UploadedFiles() files: { audio?: Express.Multer.File[], bgMusic?: Express.Multer.File[], images?: Express.Multer.File[] },
    @Body() body: { duration?: string; script?: string; bgMusicId?: string; projectId?: string },
  ) {
    try {
      console.log("📥 [DEBUG] Received Assemble Request:");
      console.log(` - ProjectID: ${body.projectId || 'dev-session'}`);
      console.log(` - Audio: ${files.audio?.[0] ? files.audio[0].originalname + ' (' + files.audio[0].size + ' bytes)' : 'MISSING'}`);
      console.log(` - Images: ${files.images?.length || 0} files received`);
      console.log(` - BG Music: ${files.bgMusic?.[0] ? files.bgMusic[0].originalname : 'None'}`);

      let bgMusicFile = files.bgMusic?.[0];
      const projectId = body.projectId || 'dev-session';

      if (!files.audio?.[0] || !files.images || files.images.length === 0) {
        console.error("❌ [ERROR] Missing required files:", { hasAudio: !!files.audio?.[0], imageCount: files.images?.length });
        throw new BadRequestException('Audio and images are required');
      }

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

      const videoUrl = await this.videoService.assembleVideo(
        files.audio[0],
        files.images,
        parseFloat(body.duration || '0'),
        body.script,
        bgMusicFile,
        undefined,
        projectId
      );

      return { 
        message: 'Video assembly started in background', 
        projectId,
        videoUrl // This is the future URL
      };
    } catch (error) {
      console.error("🔥 [CRITICAL] ASSEMBLE CONTROLLER ERROR:", error);
      throw error;
    }
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
