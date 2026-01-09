import { AiService } from './ai.service';
export declare class AiController {
    private aiService;
    constructor(aiService: AiService);
    generateScript({ topic }: {
        topic: string;
    }): Promise<string>;
    generateImagePrompts({ script }: {
        script: string;
    }): Promise<string[]>;
}
