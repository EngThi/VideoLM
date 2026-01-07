
import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  async generateScript(topic: string): Promise<string> {
    // TODO: Integrar com Gemini API
    // Por enquanto, retorna placeholder
    return `Generated script about: ${topic}\n\nThis is a placeholder. Connect to Gemini API.`;
  }

  async generateImagePrompts(script: string): Promise<string[]> {
    // TODO: Gerar prompts de imagem a partir do script
    return ['Prompt 1', 'Prompt 2', 'Prompt 3'];
  }
}
