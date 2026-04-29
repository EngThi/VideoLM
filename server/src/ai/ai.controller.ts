
import { Controller, Post, Body, Res, UseGuards, Inject, forwardRef, Headers } from '@nestjs/common';
import { AiService, ImageOptions, UserApiKeys } from './ai.service';
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

  private getUserApiKeys(headers: Record<string, string | string[] | undefined>): UserApiKeys {
    const read = (name: string) => {
      const value = headers[name];
      return Array.isArray(value) ? value[0] : value;
    };

    return {
      geminiApiKey: read('x-user-gemini-api-key'),
      openRouterApiKey: read('x-user-openrouter-api-key'),
      hfTokens: read('x-user-hf-tokens'),
    };
  }

  @Post('script')
  async generateScript(
    @Body() { topic, durationMinutes }: { topic: string; durationMinutes?: number },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const text = await this.aiService.generateScript(topic, durationMinutes, this.getUserApiKeys(headers));
    return { text };
  }

  @Post('ideas')
  generateIdeas(
    @Body() { topic }: { topic: string },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.aiService.generateContentIdeas(topic, this.getUserApiKeys(headers));
  }

  @Post('image-prompts')
  generateImagePrompts(
    @Body() { script }: { script: string },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.aiService.generateImagePrompts(script, this.getUserApiKeys(headers));
  }

  @Post('image')
  async generateImage(
    @Body() { prompt, options }: { prompt: string; options?: ImageOptions },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.aiService.generateSingleImage(prompt, options, this.getUserApiKeys(headers));
  }

  @Post('voiceover')
  async generateVoiceover(
    @Body() { script }: { script: string; voice?: string },
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res() res: Response,
  ) {
    const { audioBuffer, duration } = await this.aiService.generateVoiceover(script, this.getUserApiKeys(headers));
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', 'inline; filename="voiceover.wav"');
    res.setHeader('X-Audio-Duration', String(duration));
    return res.send(audioBuffer);
  }

  @Post('veo-test')
  async testVeo(
    @Body() { prompt }: { prompt: string },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const videoUrl = await this.aiService.generateStandaloneVideo(prompt, this.getUserApiKeys(headers));
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
