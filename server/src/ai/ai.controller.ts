
import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('api/ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('script')
  generateScript(@Body() { topic }: { topic: string }) {
    return this.aiService.generateScript(topic);
  }

  @Post('image-prompts')
  generateImagePrompts(@Body() { script }: { script: string }) {
    return this.aiService.generateImagePrompts(script);
  }
}
