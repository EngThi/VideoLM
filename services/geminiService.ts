
import type { ContentIdea, ScriptResult } from '../types';
import { authService } from './authService';

class GeminiService {
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!text) return null;
    if (contentType.includes('application/json')) {
      return JSON.parse(text);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

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
      return await this.parseResponse(response);
    } catch (error) {
      console.error("Error calling backend for ideas:", error);
      return [];
    }
  }

  /**
   * Gera o roteiro completo via Backend
   */
  public async generateScript(topic: string, durationMinutes: number = 3): Promise<ScriptResult> {
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
      const data = await this.parseResponse(response);
      const scriptText = typeof data === 'string' ? data : (data.text || '');
      return {
        scriptText,
        sources: [] // Gemini-only flow doesn't return structured sources yet
      };
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
      return await this.parseResponse(response);
    } catch (error) {
      console.error("Error calling backend for image prompts:", error);
      return [];
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

  public async generateVoiceover(script: string, voice: string = 'aoede'): Promise<{ url: string; duration: number }> {
    try {
      const response = await fetch('/api/ai/voiceover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({ script, voice }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate voiceover: ${response.status} ${errorText}`);
      }

      const blob = await response.blob();
      return {
        url: URL.createObjectURL(blob),
        duration: Number(response.headers.get('x-audio-duration') || 0),
      };
    } catch (error) {
      console.error("Error calling backend for voiceover:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
// Mantendo exportações individuais para compatibilidade com App.tsx
export const generateContentIdeas = (topic: string) => geminiService.generateContentIdeas(topic);
export const generateScript = (topic: string, duration: number) => geminiService.generateScript(topic, duration / 60);
export const generateScriptWithGoogleSearch = (topic: string, title: string, outline: string, duration: number) => geminiService.generateScript(`${topic} - ${title} - ${outline}`, duration / 60);
export const generateNarration = (script: string, voice: string) => geminiService.generateVoiceover(script, voice);
export const generateImagePrompts = (script: string, duration: number) => geminiService.generateImagePrompts(script);
export const generateVeoVideo = (prompt: string) => geminiService.generateVeoVideo(prompt);
