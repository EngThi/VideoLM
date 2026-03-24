import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class VideoGateway {
  @WebSocketServer()
  server: Server;

  broadcastProgress(projectId: string, progress: number, stage: string) {
    if (this.server) {
      this.server.emit('videoProgress', { projectId, progress, stage });
    } else {
      // Se estiver em modo teste ou o socket não estiver pronto, apenas logamos
      const logger = new Logger('VideoGateway');
      logger.log(`[Progress Update] Project: ${projectId} | ${progress}% | Stage: ${stage}`);
    }
  }


  @SubscribeMessage('subscribe')
  handleSubscribe(@MessageBody() projectId: string) {
    return { event: 'subscribed', data: projectId };
  }
}
