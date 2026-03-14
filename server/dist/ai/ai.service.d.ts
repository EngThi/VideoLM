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
export declare class AiService {
    private readonly logger;
    private readonly openRouterKey;
    private readonly geminiKey;
    private readonly hfToken;
    private readonly replicateToken;
    private callOpenRouter;
    private callGemini;
    generate(prompt: string): Promise<LLMResult>;
    generateScript(topic: string): Promise<string>;
    generateContentIdeas(topic: string): Promise<any[]>;
    generateImagePrompts(script: string): Promise<string[]>;
    generateVoiceover(script: string, voiceName?: string): Promise<{
        audioBuffer: Buffer;
        duration: number;
    }>;
    generateSingleImage(prompt: string, options?: ImageOptions): Promise<ImageGenerationResult>;
    private generateImagePollinations;
    private generateImageHuggingFace;
    generateImages(prompts: string[]): Promise<string[]>;
    private textToBlocks;
    downloadImages(urls: string[]): Promise<Buffer[]>;
    private downloadImageAsBuffer;
    private fallbackPrompts;
}
export {};
