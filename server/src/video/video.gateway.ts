
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
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
    this.server.emit(`progress:${projectId}`, { progress, stage });
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(@MessageBody() projectId: string) {
    return { event: 'subscribed', data: projectId };
  }
}
