import { AiService, ImageOptions } from './ai.service';
import { VideoService } from '../video/video.service';
import { Response } from 'express';
export declare class AiController {
    private aiService;
    private videoService;
    constructor(aiService: AiService, videoService: VideoService);
    generateScript({ topic }: {
        topic: string;
    }): Promise<string>;
    generateIdeas({ topic }: {
        topic: string;
    }): Promise<any[]>;
    generateImagePrompts({ script }: {
        script: string;
    }): Promise<string[]>;
    generateImage({ prompt, options }: {
        prompt: string;
        options?: ImageOptions;
    }): Promise<import("./ai.service").ImageGenerationResult>;
    generateVideo({ topic }: {
        topic: string;
    }, res: Response): Promise<void>;
}
