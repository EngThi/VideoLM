
import { Controller, Post, Body, Res, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { AiService, ImageOptions } from './ai.service';
import { VideoService } from '../video/video.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@Controller('api/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private aiService: AiService,
    @Inject(forwardRef(() => VideoService))
    private videoService: VideoService,
  ) {}

  @Post('script')
  generateScript(@Body() { topic }: { topic: string }) {
    return this.aiService.generateScript(topic);
  }

  @Post('ideas')
  generateIdeas(@Body() { topic }: { topic: string }) {
    return this.aiService.generateContentIdeas(topic);
  }

  @Post('image-prompts')
  generateImagePrompts(@Body() { script }: { script: string }) {
    return this.aiService.generateImagePrompts(script);
  }

  @Post('image')
  async generateImage(@Body() { prompt, options }: { prompt: string; options?: ImageOptions }) {
    return this.aiService.generateSingleImage(prompt, options);
  }

  @Post('veo-test')
  async testVeo(@Body() { prompt }: { prompt: string }) {
    const videoUrl = await this.aiService.generateStandaloneVideo(prompt);
    return { videoUrl };
  }

  @Post('generate-video')
  async generateVideo(
    @Body() { topic, durationMinutes }: { topic: string; durationMinutes?: number },
    @Res() res: Response,
  ) {
    // 1. Generate Script
    const script = await this.aiService.generateScript(topic, durationMinutes);

    // 2. Generate Image Prompts
    const imagePrompts = await this.aiService.generateImagePrompts(script);

    // 3. Generate Image URLs
    const imageUrls = await this.aiService.generateImages(imagePrompts);

    // 4. Generate Audio (TTS)
    const { audioBuffer, duration } = await this.aiService.generateVoiceover(
      script,
    );

    const audioFile = {
      buffer: audioBuffer,
      originalname: 'audio.wav',
      mimetype: 'audio/wav',
    } as Express.Multer.File;

    // 5. Download images
    const imageBuffers = await this.aiService.downloadImages(imageUrls);
    const imageFiles = imageBuffers.map((buffer, i) => ({
      buffer,
      originalname: `image-${i}.jpg`,
      mimetype: 'image/jpeg',
    })) as Express.Multer.File[];


    // 6. Assemble Video
    const videoUrl = await this.videoService.assembleVideo(
      audioFile,
      imageFiles,
      duration,
      script,
      undefined, // No background music for now
    );

    // 7. Return JSON response
    return res.json({
      message: 'Video generation started in background',
      videoUrl,
    });
  }
}
