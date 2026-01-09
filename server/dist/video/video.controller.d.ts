import { VideoService } from './video.service';
import { Response } from 'express';
export declare class VideoController {
    private videoService;
    constructor(videoService: VideoService);
    assembleVideo(files: {
        audio?: Express.Multer.File[];
        bgMusic?: Express.Multer.File[];
        images?: Express.Multer.File[];
    }, body: {
        duration?: string;
        script?: string;
    }, res: Response): Promise<void>;
    generateVideo(projectId: string, { theme }: {
        theme?: string;
    }): Promise<{
        status: string;
        videoPath?: string;
        error?: string;
    }>;
    getStatus(projectId: string): Promise<any>;
}
