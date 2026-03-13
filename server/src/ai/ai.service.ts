import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface LLMResult {
  text: string;
  provider: 'openrouter' | 'gemini' | 'fallback';
}

// ──────────────────────────────────────────────
// AiService — Gemini primary, OpenRouter fallback
// ──────────────────────────────────────────────
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private readonly openRouterKey = process.env.OPENROUTER_API_KEY ?? '';
  private readonly geminiKey = process.env.GEMINI_API_KEY ?? '';

  // ── Core LLM router ──────────────────────────
  private async callOpenRouter(
    messages: OpenRouterMessage[],
    model = 'google/gemini-2.0-flash-exp:free',
  ): Promise<string> {
    if (!this.openRouterKey) throw new Error('OPENROUTER_API_KEY not set');

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/EngThi/ai-video-factory',
        'X-Title': 'AI Video Factory',
      },
      body: JSON.stringify({ model, messages, max_tokens: 2048 }),
    });

    if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0].message.content;
  }

  private async callGemini(prompt: string): Promise<string> {
    if (!this.geminiKey) throw new Error('GEMINI_API_KEY not set');

    const ai = new GoogleGenAI({ apiKey: this.geminiKey });
    const model = ai.models.gemini('gemini-2.5-flash'); // Access model directly
    const result = await model.generateContent(prompt);
    return result.text;
  }

  async generate(prompt: string): Promise<LLMResult> {
    // 1️⃣ Try Gemini (21,600 req/day free)
    try {
      this.logger.log('LLM → Gemini');
      const text = await this.callGemini(prompt);
      return { text, provider: 'gemini' };
    } catch (e) {
      this.logger.warn(`Gemini failed: ${(e as Error).message}`);
    }

    // 2️⃣ Fallback: OpenRouter (free tier — no daily hard limit on flash-exp)
    try {
      this.logger.log('LLM → OpenRouter fallback');
      const text = await this.callOpenRouter([{ role: 'user', content: prompt }]);
      return { text, provider: 'openrouter' };
    } catch (e) {
      this.logger.warn(`OpenRouter failed: ${(e as Error).message}`);
    }

    // 3️⃣ Last resort: static stub (CI/offline)
    this.logger.error('All LLM providers failed — using stub');
    return { text: `[STUB] Response for: ${prompt.slice(0, 60)}…`, provider: 'fallback' };
  }

  // ── Public pipeline methods ───────────────────

  async generateScript(topic: string): Promise<string> {
    const prompt = `You are a YouTube scriptwriter. Write a compelling, factual video script about: "${topic}".

Requirements:
- Duration: ~3 minutes (≈450 words)
- Tone: Engaging, conversational
- Structure: Hook → Content (3 key points) → CTA
- No fluff. Every sentence must add value.

Return ONLY the script text, no extra commentary.`;

    const { text, provider } = await this.generate(prompt);
    this.logger.log(`Script generated via ${provider}`);
    return text;
  }

  async generateImagePrompts(script: string): Promise<string[]> {
    const prompt = `You are a visual director. Given this video script, generate exactly 5 image prompts for AI image generation.

SCRIPT:
${script}

Rules:
- Each prompt describes ONE clear visual scene
- Style: cinematic, high quality, photorealistic
- No text in images
- Return ONLY a JSON array of 5 strings, nothing else.
Example: ["prompt 1", "prompt 2", "prompt 3", "prompt 4", "prompt 5"]`;

    const { text } = await this.generate(prompt);

    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      const prompts = JSON.parse(cleaned) as string[];
      return Array.isArray(prompts) ? prompts.slice(0, 5) : this.fallbackPrompts();
    } catch {
      this.logger.warn('Failed to parse image prompts JSON — using fallback');
      return this.fallbackPrompts();
    }
  }

  async generateVoiceover(script: string): Promise<string> {
    // Returns cleaned script text ready for TTS (Google TTS / ElevenLabs / etc)
    const cleaned = script
      .replace(/\[.*?\]/g, '')      // remove stage directions
      .replace(/\(.*?\)/g, '')      // remove parentheticals
      .replace(/\n{3,}/g, '\n\n')   // normalize whitespace
      .trim();

    this.logger.log(`Voiceover text prepared (${cleaned.length} chars)`);
    // Actual TTS call goes here (Google Cloud TTS, etc.)
    // For now returns the cleaned text — frontend handles TTS
    return cleaned;
  }

  async generateImages(prompts: string[]): Promise<string[]> {
    // Uses Pollinations AI (free, no key required)
    const imageUrls = prompts.map((prompt, i) => {
      const encoded = encodeURIComponent(prompt);
      const seed = Date.now() + i;
      return `https://image.pollinations.ai/prompt/${encoded}?width=1280&height=720&seed=${seed}&nologo=true`;
    });

    this.logger.log(`Generated ${imageUrls.length} image URLs via Pollinations`);
    return imageUrls;
  }

  // ── Helpers ───────────────────────────────────
  private fallbackPrompts(): string[] {
    return [
      'Cinematic wide shot of modern technology, dark background, blue accents',
      'Close-up of data flowing through digital networks, neon lights',
      'Abstract visualization of artificial intelligence, glowing nodes',
      'Person working on laptop in futuristic environment, ambient lighting',
      'High-tech server room with dynamic lighting, depth of field',
    ];
  }
}