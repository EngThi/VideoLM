"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const genai_1 = require("@google/genai");
let AiService = AiService_1 = class AiService {
    constructor() {
        var _a, _b, _c, _d;
        this.logger = new common_1.Logger(AiService_1.name);
        this.openRouterKey = (_a = process.env.OPENROUTER_API_KEY) !== null && _a !== void 0 ? _a : '';
        this.geminiKey = ((_b = process.env.GEMINI_API_KEY) !== null && _b !== void 0 ? _b : '').split(',')[0].trim();
        this.hfToken = (_c = process.env.HF_TOKEN) !== null && _c !== void 0 ? _c : '';
        this.replicateToken = (_d = process.env.REPLICATE_TOKEN) !== null && _d !== void 0 ? _d : '';
    }
    async callOpenRouter(messages, model = 'google/gemini-2.0-flash-exp:free') {
        if (!this.openRouterKey)
            throw new Error('OPENROUTER_API_KEY not set');
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
        if (!res.ok)
            throw new Error(`OpenRouter error: ${res.status}`);
        const data = (await res.json());
        return data.choices[0].message.content;
    }
    async callGemini(prompt) {
        if (!this.geminiKey)
            throw new Error('GEMINI_API_KEY not set');
        const ai = new genai_1.GoogleGenAI({ apiKey: this.geminiKey });
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        return result.text;
    }
    async generate(prompt) {
        try {
            this.logger.log('LLM → Gemini');
            const text = await this.callGemini(prompt);
            return { text, provider: 'gemini' };
        }
        catch (e) {
            this.logger.warn(`Gemini failed: ${e.message}`);
        }
        try {
            this.logger.log('LLM → OpenRouter fallback');
            const text = await this.callOpenRouter([{ role: 'user', content: prompt }]);
            return { text, provider: 'openrouter' };
        }
        catch (e) {
            this.logger.warn(`OpenRouter failed: ${e.message}`);
        }
        this.logger.error('All LLM providers failed — using stub');
        return { text: `[STUB] Response for: ${prompt.slice(0, 60)}…`, provider: 'fallback' };
    }
    async generateScript(topic) {
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
    async generateContentIdeas(topic) {
        const prompt = `You are an expert YouTube video scriptwriter.
    For the topic "${topic}", generate 3 distinct video ideas.
    Each idea must have a catchy "title" and a 3-point "outline".
    Return ONLY a JSON array of 3 objects.
    Example: [{"title": "Idea 1", "outline": "Point 1\nPoint 2\nPoint 3"}]`;
        const { text } = await this.generate(prompt);
        try {
            const cleaned = text.replace(/```json|```/g, '').trim();
            return JSON.parse(cleaned);
        }
        catch (_a) {
            return [
                { title: `${topic} - Basics`, outline: "Intro to topic\nKey concepts\nConclusion" },
                { title: `${topic} - Deep Dive`, outline: "History\nAdvanced analysis\nFuture outlook" },
                { title: `${topic} - Top 5 Tips`, outline: "Tip 1-2\nTip 3-4\nFinal tip" },
            ];
        }
    }
    async generateImagePrompts(script) {
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
            const prompts = JSON.parse(cleaned);
            return Array.isArray(prompts) ? prompts.slice(0, 5) : this.fallbackPrompts();
        }
        catch (_a) {
            this.logger.warn('Failed to parse image prompts JSON — using fallback');
            return this.fallbackPrompts();
        }
    }
    async generateVoiceover(script, voiceName = 'echo') {
        var _a, _b, _c, _d, _e;
        this.logger.log(`Starting TTS generation with voice: ${voiceName}`);
        const cleanedScript = script
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        const chunks = this.textToBlocks(cleanedScript);
        const audioParts = [];
        const ai = new genai_1.GoogleGenAI({ apiKey: this.geminiKey });
        this.logger.log(`Generating audio for ${chunks.length} chunks...`);
        for (const [index, chunk] of chunks.entries()) {
            this.logger.log(`Processing chunk ${index + 1}/${chunks.length}`);
            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: [{ role: 'user', parts: [{ text: chunk }] }],
                    config: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: voiceName },
                            },
                        },
                    },
                });
                const part = (_d = (_c = (_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d.find(p => p.inlineData);
                if ((_e = part === null || part === void 0 ? void 0 : part.inlineData) === null || _e === void 0 ? void 0 : _e.data) {
                    audioParts.push(Buffer.from(part.inlineData.data, 'base64'));
                }
            }
            catch (error) {
                this.logger.error(`TTS chunk failed for voice ${voiceName}: ${error.message}`);
            }
        }
        if (audioParts.length === 0) {
            throw new Error('No audio data could be generated from Gemini TTS.');
        }
        const mergedAudio = Buffer.concat(audioParts);
        const duration = mergedAudio.length / 48000;
        this.logger.log(`TTS generation complete. Total duration: ${duration.toFixed(2)}s`);
        return { audioBuffer: mergedAudio, duration };
    }
    async generateSingleImage(prompt, options) {
        const providers = [
            { name: 'Gemini', fn: this.generateImageGemini.bind(this) },
            { name: 'HuggingFace', fn: this.generateImageHuggingFace.bind(this) },
            { name: 'Pollinations', fn: this.generateImagePollinations.bind(this) },
        ];
        for (const provider of providers) {
            try {
                const url = await provider.fn(prompt, options);
                if (url) {
                    this.logger.log(`✅ Image generated via ${provider.name}`);
                    return { success: true, url, provider: provider.name, timestamp: new Date().toISOString() };
                }
            }
            catch (error) {
                this.logger.warn(`⚠️ ${provider.name} failed: ${error.message}`);
            }
        }
        return { success: false, provider: 'none', timestamp: new Date().toISOString(), error: 'All image providers failed' };
    }
    async generateImageGemini(prompt, options) {
        var _a, _b, _c, _d;
        if (!this.geminiKey)
            return null;
        this.logger.log('Attempting: Gemini 2.5 Flash-image (Native Generation)');
        try {
            const ai = new genai_1.GoogleGenAI({ apiKey: this.geminiKey });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                config: {
                    responseModalities: ['IMAGE', 'TEXT'],
                },
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });
            const part = (_d = (_c = (_b = (_a = result.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d.find(p => p.inlineData);
            if (part === null || part === void 0 ? void 0 : part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
            return null;
        }
        catch (error) {
            this.logger.error(`Gemini Image Error: ${error.message}`);
            return null;
        }
    }
    async generateImagePollinations(prompt, options) {
        this.logger.log('Attempting: Pollinations.AI (Emergency Fallback)');
        const width = (options === null || options === void 0 ? void 0 : options.width) || 1280;
        const height = (options === null || options === void 0 ? void 0 : options.height) || 720;
        const seed = Math.floor(Math.random() * 1000000);
        return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
    }
    async generateImageHuggingFace(prompt, options) {
        if (!this.hfToken)
            return null;
        this.logger.log('Attempting: Hugging Face (SDXL Router)');
        try {
            const response = await fetch('https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0', {
                headers: { Authorization: `Bearer ${this.hfToken}`, 'Content-Type': 'application/json' },
                method: 'POST',
                body: JSON.stringify({ inputs: prompt }),
            });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(err);
            }
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            return `data:image/jpeg;base64,${base64}`;
        }
        catch (error) {
            this.logger.warn(`HuggingFace Error: ${error.message}`);
            return null;
        }
    }
    async generateImages(prompts) {
        this.logger.log(`Generating ${prompts.length} images via orchestrator...`);
        const urls = [];
        for (const prompt of prompts) {
            const res = await this.generateSingleImage(prompt);
            if (res.url)
                urls.push(res.url);
            await new Promise(r => setTimeout(r, 500));
        }
        return urls;
    }
    textToBlocks(fullText, maxWords = 500) {
        const words = fullText.split(/\s+/);
        const blocks = [];
        let currentBlockWords = [];
        for (const word of words) {
            currentBlockWords.push(word);
            if (currentBlockWords.length >= maxWords) {
                blocks.push(currentBlockWords.join(' '));
                currentBlockWords = [];
            }
        }
        if (currentBlockWords.length > 0) {
            blocks.push(currentBlockWords.join(' '));
        }
        return blocks;
    }
    async downloadImages(urls) {
        this.logger.log(`Downloading ${urls.length} images...`);
        const downloadPromises = urls.map(url => this.downloadImageAsBuffer(url));
        return Promise.all(downloadPromises);
    }
    async downloadImageAsBuffer(url) {
        try {
            if (url.startsWith('data:image')) {
                const base64 = url.split(',')[1];
                return Buffer.from(base64, 'base64');
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        catch (error) {
            this.logger.error(`Error downloading image from ${url}: ${error.message}`);
            throw error;
        }
    }
    fallbackPrompts() {
        return [
            'Cinematic wide shot of modern technology, dark background, blue accents',
            'Close-up of data flowing through digital networks, neon lights',
            'Abstract visualization of artificial intelligence, glowing nodes',
            'Person working on laptop in futuristic environment, ambient lighting',
            'High-tech server room with dynamic lighting, depth of field',
        ];
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)()
], AiService);
//# sourceMappingURL=ai.service.js.map