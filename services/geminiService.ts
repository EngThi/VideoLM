
import type { ContentIdea, ScriptResult } from '../types';
import { authService } from './authService';

class GeminiService {
  /**
   * Obtém ideias de conteúdo do Backend (Protegido por JWT)
   */
  public async generateContentIdeas(topic: string): Promise<ContentIdea[]> {
    try {
      const response = await fetch('/api/ai/ideas', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({ topic }),
      });

      if (!response.ok) throw new Error('Failed to fetch ideas from server');
      return await response.json();
    } catch (error) {
      console.error("Error calling backend for ideas:", error);
      return [];
    }
  }

  /**
   * Gera o roteiro completo via Backend
   */
  public async generateScript(topic: string, durationMinutes: number = 3): Promise<string> {
    try {
      const response = await fetch('/api/ai/script', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({ topic, durationMinutes }),
      });

      if (!response.ok) throw new Error('Failed to generate script via server');
      const data = await response.json();
      return typeof data === 'string' ? data : (data.text || '');
    } catch (error) {
      console.error("Error calling backend for script:", error);
      throw error;
    }
  }

  /**
   * Gera prompts de imagem baseados no roteiro via Backend
   */
  public async generateImagePrompts(script: string): Promise<string[]> {
    try {
      const response = await fetch('/api/ai/image-prompts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({ script }),
      });

      if (!response.ok) throw new Error('Failed to generate image prompts via server');
      return await response.json();
    } catch (error) {
      console.error("Error calling backend for image prompts:", error);
      return [];
    }
  }
}

  /**
   * Gera um vídeo de teste (Veo 2.0 Lab) via Backend
   */
  public async generateVeoVideo(prompt: string): Promise<string> {
    try {
      const response = await fetch('/api/ai/veo-test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) throw new Error('Failed to generate test video');
      const data = await response.json();
      return data.videoUrl;
    } catch (error) {
      console.error("Error calling backend for Veo test:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
// Mantendo exportações individuais para compatibilidade com App.tsx
export const generateContentIdeas = (topic: string) => geminiService.generateContentIdeas(topic);
export const generateScript = (topic: string, duration: number) => geminiService.generateScript(topic, duration / 60);
export const generateImagePrompts = (script: string, duration: number) => geminiService.generateImagePrompts(script);
export const generateVeoVideo = (prompt: string) => geminiService.generateVeoVideo(prompt);
