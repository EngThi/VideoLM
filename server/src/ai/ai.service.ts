
import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { InferenceClient } from "@huggingface/inference";
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { KeyManagerService } from './key-manager.service';

// ──────────────────────────────────────────────
// Types & Interfaces
// ──────────────────────────────────────────────
interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface LLMResult {
  text: string;
  provider: 'openrouter' | 'gemini' | 'fallback';
}

export interface ImageGenerationResult {
  success: boolean;
  url?: string;
  provider: string;
  timestamp: string;
  error?: string;
}

export interface ImageOptions {
  width?: number;
  height?: number;
}

// ──────────────────────────────────────────────
// AiService — Multi-Provider Orchestrator
// ──────────────────────────────────────────────
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private readonly openRouterKey = process.env.OPENROUTER_API_KEY ?? '';
  private readonly geminiKeyManager = new KeyManagerService(process.env.GEMINI_API_KEY ?? '', 'Gemini AI');
  private readonly hfKeyManager = new KeyManagerService(process.env.HF_TOKENS || process.env.HF_TOKEN || '', 'Hugging Face');
  private readonly pollinationsKey = 'sk_8Tvzw1GX6O3gBe7oNl3ZIvfnCO3eQhVm';

  private readonly cacheDir = path.join(process.cwd(), 'cache');

  constructor() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  // ── Helper: Exponential Backoff ─────────────
  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── LLM Methods ──────────────────────────────
  
  private async callGemini(prompt: string): Promise<string> {
    const promptHash = crypto.createHash('md5').update(prompt).digest('hex');
    const cachePath = path.join(this.cacheDir, `llm_${promptHash}.txt`);

    if (fs.existsSync(cachePath)) {
        this.logger.log('LLM → Cache Hit');
        return fs.readFileSync(cachePath, 'utf-8');
    }

    let attempts = 0;
    const maxKeys = 5;

    while (attempts < maxKeys) {
        const key = this.geminiKeyManager.getCurrentKey();
        if (!key) throw new Error('GEMINI_API_KEY not set');

        try {
            const ai = new GoogleGenAI({ apiKey: key });
            const result = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });
            const text = result.text;
            fs.writeFileSync(cachePath, text);
            return text;
        } catch (e) {
            if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
                const backoffDelay = Math.pow(2, attempts) * 1000;
                this.logger.warn(`Gemini LLM Quota Exceeded. Waiting ${backoffDelay}ms before rotating key...`);
                await this.sleep(backoffDelay);
                
                if (this.geminiKeyManager.rotate()) {
                    attempts++;
                    continue;
                }
            }
            throw e;
        }
    }
    throw new Error('All Gemini keys exhausted for LLM');
  }

  async generate(prompt: string): Promise<LLMResult> {
    try {
      this.logger.log('LLM → Gemini 3 Flash');
      const text = await this.callGemini(prompt);
      return { text, provider: 'gemini' };
    } catch (e) {
      this.logger.warn(`Gemini failed: ${e.message}`);
      return { text: `[STUB] Content for: ${prompt.slice(0, 50)}`, provider: 'fallback' };
    }
  }

  // ── Image Generation Methods ──────────────────

  async generateSingleImage(prompt: string, options?: ImageOptions): Promise<ImageGenerationResult> {
    const promptHash = crypto.createHash('md5').update(prompt).digest('hex');
    const cachePath = path.join(this.cacheDir, `img_${promptHash}.png`);

    if (fs.existsSync(cachePath)) {
        this.logger.log('Image → Cache Hit');
        return { 
            success: true, 
            url: `data:image/png;base64,${fs.readFileSync(cachePath).toString('base64')}`, 
            provider: 'cache', 
            timestamp: new Date().toISOString() 
        };
    }

    const providers = [
      { name: 'Gemini-2.5', fn: this.generateImageGemini.bind(this) },
      { name: 'OpenRouter', fn: this.generateImageOpenRouter.bind(this) },
      { name: 'HuggingFace', fn: this.generateImageHuggingFace.bind(this) },
      { name: 'Pollinations', fn: this.generateImagePollinations.bind(this) },
    ];

    for (const provider of providers) {
      try {
          this.logger.log(`Attempting image generation via ${provider.name}...`);
          const url = await provider.fn(prompt, options);
          if (url) {
              // Validar se não é um JSON de erro disfarçado
              if (url.startsWith('data:image/png;base64,')) {
                  const base64Data = url.replace(/^data:image\/png;base64,/, "");
                  const buffer = Buffer.from(base64Data, 'base64');
                  const preview = buffer.toString('utf8', 0, 100);
                  if (preview.trim().startsWith('{')) {
                      throw new Error('Provider returned JSON error instead of image data');
                  }
                  fs.writeFileSync(cachePath, base64Data, 'base64');
              } else {
                  const res = await fetch(url);
                  const contentType = res.headers.get('content-type');
                  if (contentType && contentType.includes('json')) {
                    throw new Error('Provider URL points to a JSON instead of an image');
                  }
                  const buffer = Buffer.from(await res.arrayBuffer());
                  const preview = buffer.toString('utf8', 0, 100);
                  if (preview.trim().startsWith('{')) {
                    throw new Error('Provider URL content is a JSON error message');
                  }
                  fs.writeFileSync(cachePath, buffer);
              }
              this.logger.log(`✅ Image generated via ${provider.name}`);
              return { success: true, url, provider: provider.name, timestamp: new Date().toISOString() };
          }
      } catch (error) {
          this.logger.warn(`⚠️ ${provider.name} failed: ${error.message}`);
          continue;
      }
    }

    return { success: false, provider: 'none', timestamp: new Date().toISOString(), error: 'All image providers failed' };
  }

  private async generateImageOpenRouter(prompt: string, options?: ImageOptions): Promise<string | null> {
    if (!this.openRouterKey) return null;
    this.logger.log('Attempting: OpenRouter (FLUX 2 Max)');
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/EngThi/ai-video-factory',
          'X-Title': 'AI Video Factory',
        },
        body: JSON.stringify({
          model: 'black-forest-labs/flux.2-max',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = (await response.json()) as any;
      
      const images = data.choices?.[0]?.message?.images;
      if (images && images.length > 0 && images[0].image_url?.url) {
        return images[0].image_url.url;
      }

      const content = data.choices?.[0]?.message?.content;
      if (content && (content.includes('http') || content.includes('data:image'))) {
        const match = content.match(/(https?:\/\/[^\s]+|data:image\/[^\s]+)/);
        return match ? match[0] : null;
      }
      return null;
    } catch (error) {
      this.logger.error(`OpenRouter Image Error: ${error.message}`);
      return null;
    }
  }

  private async generateImageHuggingFace(prompt: string, options?: ImageOptions): Promise<string | null> {
    let attempts = 0;
    const maxKeys = 5;

    while (attempts < maxKeys) {
        const token = this.hfKeyManager.getCurrentKey();
        if (!token) return null;

        try {
            const client = new InferenceClient(token);
            const response: any = await client.textToImage({
                model: "black-forest-labs/FLUX.1-schnell",
                inputs: prompt,
                parameters: { num_inference_steps: 4 },
            });

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            return `data:image/png;base64,${buffer.toString('base64')}`;
        } catch (error) {
            this.logger.warn(`HF Token failed: ${error.message}`);
            this.hfKeyManager.rotate();
            attempts++;
        }
    }
    return null;
  }

  private async generateImagePollinations(prompt: string, options?: ImageOptions): Promise<string | null> {
    const seed = Math.floor(Math.random() * 1000000);
    // Use 'turbo' as suggested by documentation and models list
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=720&nologo=true&seed=${seed}&model=turbo`;
  }

  private async generateImageGemini(prompt: string, options?: ImageOptions): Promise<string | null> {
    const key = this.geminiKeyManager.getCurrentKey();
    if (!key) return null;

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          // @ts-ignore
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K",
            outputMimeType: "image/png",
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any }
          ]
        },
      });

      const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part?.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
      return null;
    } catch (error) {
      this.logger.error(`Gemini Image Error: ${error.message}`);
      return null;
    }
  }

  // ── Public Pipeline Methods ───────────────────

  async generateContentIdeas(topic: string): Promise<any[]> {
    const prompt = `Generate 3 catchy YouTube video ideas for: "${topic}". Return JSON: [{"title": "...", "outline": "..."}]`;
    const { text } = await this.generate(prompt);
    try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
    catch { return [{ title: topic, outline: "Intro\nDeep Dive\nOutro" }]; }
  }

  async generateScript(topic: string, durationMinutes: number = 3): Promise<string> {
    const prompt = `Write a ${durationMinutes}-minute factual YouTube script for: "${topic}". Return ONLY script text.`;
    const { text } = await this.generate(prompt);
    return text;
  }

  /**
   * Gera prompts de imagem baseados nas fontes de pesquisa do NotebookLM
   */
  async generateStoryboardFromResearch(topic: string, sources: string[]): Promise<string[]> {
    this.logger.log(`Gerando storyboard visual para pesquisa sobre: ${topic}`);
    
    const prompt = `
      Topic: ${topic}
      Research Sources: ${sources.join(', ')}
      
      I have a long audio podcast (Overview) created from these sources.
      I need to generate 10 highly descriptive, cinematic, and diverse image prompts in ENGLISH for a video.
      The images should represent the core concepts of the research and create a visual narrative.
      Format: Return ONLY a JSON array of strings.
    `;

    const { text } = await this.generate(prompt);
    
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned).slice(0, 10);
    } catch (e) {
      this.logger.error("Falha ao processar storyboard de pesquisa, usando fallback.");
      return [
        `Cinematic visualization of ${topic}`,
        `Modern laboratory researching ${topic}`,
        `Digital data visualization of ${topic}`,
        `Futuristic presentation of ${topic}`
      ];
    }
  }

  async generateImagePrompts(script: string): Promise<string[]> {
    const prompt = `Based on this script, generate exactly 5 cinematic image prompts as a JSON array of strings. SCRIPT: ${script}`;
    const { text } = await this.generate(prompt);
    try { return JSON.parse(text.replace(/```json|```/g, '').trim()).slice(0, 5); }
    catch { return ["Cinematic abstract background", "Futuristic technology", "Data flowing"]; }
  }

  async generateImages(prompts: string[]): Promise<string[]> {
    this.logger.log(`Generating batch of ${prompts.length} images...`);
    const urls: string[] = [];
    for (const prompt of prompts) {
        const res = await this.generateSingleImage(prompt);
        if (res.url) urls.push(res.url);
        await new Promise(r => setTimeout(r, 1000));
    }
    return urls;
  }

  async generateVoiceover(script: string): Promise<{ audioBuffer: Buffer; duration: number }> {
    const scriptHash = crypto.createHash('md5').update(script).digest('hex');
    const cachePath = path.join(this.cacheDir, `tts_${scriptHash}.wav`);

    if (fs.existsSync(cachePath)) {
        this.logger.log('TTS → Cache Hit');
        const buffer = fs.readFileSync(cachePath);
        return { audioBuffer: buffer, duration: buffer.length / 48000 };
    }

    let attempts = 0;
    const maxKeys = 5;

    while (attempts < maxKeys) {
        const key = this.geminiKeyManager.getCurrentKey();
        if (!key) throw new Error('GEMINI_API_KEY not set');

        try {
            const ai = new GoogleGenAI({ apiKey: key });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: [{ role: 'user', parts: [{ text: script }] }],
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'aoede' } } },
                },
            });
            const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (!part?.inlineData?.data) throw new Error("TTS Failed - No inlineData");
            const buffer = Buffer.from(part.inlineData.data, 'base64');
            fs.writeFileSync(cachePath, buffer);
            return { audioBuffer: buffer, duration: buffer.length / 48000 };
        } catch (e) {
            if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
                this.logger.warn(`Gemini TTS Quota Exceeded for key ${attempts + 1}. Rotating...`);
                if (this.geminiKeyManager.rotate()) {
                    attempts++;
                    continue;
                }
            }
            throw e;
        }
    }
    throw new Error('All Gemini keys exhausted for TTS');
  }

  async downloadImages(urls: string[]): Promise<Buffer[]> {
    return Promise.all(urls.map(async url => {
        if (url.startsWith('data:image')) return Buffer.from(url.split(',')[1], 'base64');
        const res = await fetch(url);
        return Buffer.from(await res.arrayBuffer());
    }));
  }
} 