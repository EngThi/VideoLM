export declare class AiService {
    generateScript(topic: string): Promise<string>;
    generateImagePrompts(script: string): Promise<string[]>;
    generateVoiceover(script: string): Promise<string>;
    generateImages(prompts: string[]): Promise<string[]>;
}
