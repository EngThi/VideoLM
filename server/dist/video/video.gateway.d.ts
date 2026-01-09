import { Server } from 'socket.io';
export declare class VideoGateway {
    server: Server;
    broadcastProgress(projectId: string, progress: number, stage: string): void;
    handleSubscribe(projectId: string): {
        event: string;
        data: string;
    };
}
