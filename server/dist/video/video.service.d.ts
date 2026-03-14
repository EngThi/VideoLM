import { PassThrough } from 'stream';
import { ProjectsService } from '../projects/projects.service';
import { VideoGateway } from './video.gateway';
export declare class VideoService {
    private projectsService;
    private videoGateway;
    private readonly logger;
    private enginesPath;
    constructor(projectsService: ProjectsService, videoGateway: VideoGateway);
    private generateSrt;
    private getAudioDuration;
    createClip(imagePath: string, outputPath: string, duration: number, index: number, isLast?: boolean): Promise<void>;
    assembleVideo(audioFile: Express.Multer.File, imageFiles: Express.Multer.File[], inputDuration: number, script?: string, bgMusicFile?: Express.Multer.File): Promise<PassThrough>;
    generateVideo(projectId: string, theme?: string): Promise<{
        status: string;
        videoPath?: string;
        error?: string;
    }>;
    getStatus(projectId: string): Promise<any>;
    getMusicList(): Promise<string[]>;
}
