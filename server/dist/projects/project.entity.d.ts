export declare class ProjectEntity {
    id: string;
    title: string;
    topic: string;
    script: string;
    theme: string;
    videoPath: string;
    status: 'idle' | 'processing' | 'done' | 'error';
    error: string;
    createdAt: Date;
    updatedAt: Date;
}
