import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { InferenceClient } from '@huggingface/inference';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { KeyManagerService } from './key-manager.service';

const execAsync = promisify(exec);

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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private readonly openRouterKey = process.env.OPENROUTER_API_KEY ?? '';
  private readonly geminiKeyManager = new KeyManagerService(process.env.GEMINI_API_KEY ?? '', 'Gemini AI');
  private readonly hfKeyManager = new KeyManagerService(process.env.HF_TOKENS || process.env.HF_TOKEN || '', 'Hugging Face');
  private readonly cacheDir = path.join(process.cwd(), 'cache');

  constructor() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async callGemini(prompt: string, model = 'gemini-3-flash-preview'): Promise<string> {
    const promptHash = crypto.createHash('md5').update(`${model}:${prompt}`).digest('hex');
    const cachePath = path.join(this.cacheDir, `llm_${promptHash}.txt`);

    if (fs.existsSync(cachePath)) {
      this.logger.log('LLM -> Cache Hit');
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
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const text = result.text ?? '';
        fs.writeFileSync(cachePath, text);
        return text;
      } catch (e: any) {
        if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
          const backoffDelay = Math.pow(2, attempts) * 1000;
          this.logger.warn(`Gemini LLM quota exceeded. Waiting ${backoffDelay}ms before rotating key.`);
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

  async generate(prompt: string, model?: string): Promise<LLMResult> {
    try {
      this.logger.log(`LLM -> ${model || 'gemini-3-flash-preview'}`);
      const text = await this.callGemini(prompt, model);
      return { text, provider: 'gemini' };
    } catch (e: any) {
      this.logger.warn(`Gemini failed: ${e.message}`);
      return { text: `[STUB] Content for: ${prompt.slice(0, 50)}`, provider: 'fallback' };
    }
  }

  async generateSingleImage(prompt: string, options?: ImageOptions): Promise<ImageGenerationResult> {
    const promptHash = crypto.createHash('md5').update(prompt).digest('hex');
    const cachePath = path.join(this.cacheDir, `img_${promptHash}.png`);

    if (fs.existsSync(cachePath)) {
      this.logger.log('Image -> Cache Hit');
      return {
        success: true,
        url: `data:image/png;base64,${fs.readFileSync(cachePath).toString('base64')}`,
        provider: 'cache',
        timestamp: new Date().toISOString(),
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
        this.logger.log(`Attempting image generation via ${provider.name}`);
        const url = await provider.fn(prompt, options);
        if (url) {
          return { success: true, url, provider: provider.name, timestamp: new Date().toISOString() };
        }
      } catch (error: any) {
        this.logger.warn(`${provider.name} failed: ${error.message}`);
      }
    }

    const seed = Math.floor(Math.random() * 1000000);
    const finalUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=720&nologo=true&seed=${seed}&model=turbo`;
    return { success: true, url: finalUrl, provider: 'Pollinations-Fallback', timestamp: new Date().toISOString() };
  }

  private async generateImageOpenRouter(prompt: string, options?: ImageOptions): Promise<string | null> {
    if (!this.openRouterKey) return null;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/EngThi/VideoLM',
          'X-Title': 'VideoLM',
        },
        body: JSON.stringify({
          model: 'black-forest-labs/flux.2-max',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = (await response.json()) as any;
      const images = data.choices?.[0]?.message?.images;
      if (images?.[0]?.image_url?.url) return images[0].image_url.url;

      const content = data.choices?.[0]?.message?.content;
      if (content && (content.includes('http') || content.includes('data:image'))) {
        const match = content.match(/(https?:\/\/[^\s]+|data:image\/[^\s]+)/);
        return match ? match[0] : null;
      }
      return null;
    } catch (error: any) {
      this.logger.error(`OpenRouter image error: ${error.message}`);
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
          model: 'black-forest-labs/FLUX.1-schnell',
          inputs: prompt,
          parameters: { num_inference_steps: 4 },
        });

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return `data:image/png;base64,${buffer.toString('base64')}`;
      } catch (error: any) {
        this.logger.warn(`HF token failed: ${error.message}`);
        this.hfKeyManager.rotate();
        attempts++;
      }
    }

    return null;
  }

  private async generateImagePollinations(prompt: string, options?: ImageOptions): Promise<string | null> {
    const seed = Math.floor(Math.random() * 1000000);
    const width = options?.width || 1280;
    const height = options?.height || 720;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}&model=turbo`;
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
          // @ts-ignore - image config is available in the runtime SDK used by this project.
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '1K',
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
          ],
        },
      });

      const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part?.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
      return null;
    } catch (error: any) {
      this.logger.error(`Gemini image error: ${error.message}`);
      return null;
    }
  }

  async generateContentIdeas(topic: string): Promise<any[]> {
    const prompt = `Generate 3 catchy YouTube video ideas for: "${topic}". Return JSON: [{"title": "...", "outline": "..."}]`;
    const { text } = await this.generate(prompt);
    try {
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      return [{ title: topic, outline: 'Intro\nDeep Dive\nOutro' }];
    }
  }

  async generateScript(topic: string, durationMinutes = 3): Promise<string> {
    const prompt = `Write a ${durationMinutes}-minute factual YouTube script for: "${topic}". Return ONLY script text.`;
    const { text } = await this.generate(prompt);
    return text;
  }

  async generateStoryboardFromResearch(topic: string, sources: string[]): Promise<string[]> {
    this.logger.log(`Generating visual storyboard for research topic: ${topic}`);

    const prompt = `
      Topic: ${topic}
      Research Sources: ${sources.join(', ')}

      I have a long audio podcast overview created from these sources.
      Generate 10 highly descriptive, cinematic, diverse image prompts in English.
      The images should represent the core concepts and create a visual narrative.
      Format: Return ONLY a JSON array of strings.
    `;

    const { text } = await this.generate(prompt);

    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned).slice(0, 10);
    } catch {
      this.logger.error('Failed to parse research storyboard, using fallback prompts.');
      return [
        `Cinematic visualization of ${topic}`,
        `Modern laboratory researching ${topic}`,
        `Digital data visualization of ${topic}`,
        `Futuristic presentation of ${topic}`,
      ];
    }
  }

  async generateImagePrompts(script: string): Promise<string[]> {
    const prompt = `Based on this script, generate exactly 5 cinematic image prompts as a JSON array of strings. SCRIPT: ${script}`;
    const { text } = await this.generate(prompt);
    try {
      return JSON.parse(text.replace(/```json|```/g, '').trim()).slice(0, 5);
    } catch {
      return ['Cinematic abstract background', 'Futuristic technology', 'Data flowing'];
    }
  }

  async generateImages(prompts: string[]): Promise<string[]> {
    this.logger.log(`Generating batch of ${prompts.length} images`);
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
      this.logger.log('TTS -> Cache Hit');
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
        if (!part?.inlineData?.data) throw new Error('TTS failed: no inlineData');
        const rawBuffer = Buffer.from(part.inlineData.data, 'base64');

        try {
          this.logger.log('Normalizing Gemini TTS audio through FFmpeg pipe');
          const { stdout } = await execAsync('ffmpeg -i pipe:0 -vn -ar 44100 -ac 1 -c:a pcm_s16le -f wav pipe:1', {
            input: rawBuffer,
            encoding: 'buffer',
          } as any);

          fs.writeFileSync(cachePath, stdout);
          return { audioBuffer: stdout, duration: stdout.length / (44100 * 2) };
        } catch (ffmpegErr: any) {
          this.logger.error(`Pipe transcode failed: ${ffmpegErr.message}`);
          fs.writeFileSync(cachePath, rawBuffer);
          return { audioBuffer: rawBuffer, duration: rawBuffer.length / 48000 };
        }
      } catch (e: any) {
        if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
          this.logger.warn(`Gemini TTS quota exceeded for key ${attempts + 1}. Rotating.`);
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
    return Promise.all(
      urls.map(async url => {
        if (url.startsWith('data:image')) return Buffer.from(url.split(',')[1], 'base64');
        const res = await fetch(url);
        return Buffer.from(await res.arrayBuffer());
      }),
    );
  }

  async generateStandaloneVideo(prompt: string): Promise<string> {
    const key = this.geminiKeyManager.getCurrentKey();
    if (!key) throw new Error('GEMINI_API_KEY not set');

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          // @ts-ignore - video modality is experimental in the runtime SDK.
          responseModalities: ['VIDEO'],
        },
      });

      const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!part?.inlineData?.data) {
        this.logger.warn('Video quota unavailable. Using sample fallback video.');
        return 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
      }

      const buffer = Buffer.from(part.inlineData.data, 'base64');
      const fileName = `veo_test_${Date.now()}.mp4`;
      const filePath = path.join(process.cwd(), 'public/videos', fileName);

      if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, buffer);

      return `/videos/${fileName}`;
    } catch (e: any) {
      this.logger.error(`Standalone video error: ${e.message}`);
      return 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
    }
  }
}
