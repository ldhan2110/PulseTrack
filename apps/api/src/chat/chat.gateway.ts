import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketAuthService } from '../notifications/socket-auth.service';
import { ChatService, ChatAudience } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly socketAuthService: SocketAuthService,
    private readonly chatService: ChatService,
  ) {}

  afterInit(): void {
    this.chatService.setGateway(this);
  }

  async handleConnection(socket: Socket): Promise<void> {
    const userId = await this.socketAuthService.extractUserFromHandshake(socket.handshake);
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    socket.data.userId = userId;
    await socket.join(`user:${userId}`);
  }

  @SubscribeMessage('chat:join-project')
  handleJoinProject(socket: Socket, projectId: string): void {
    if (socket.data.userId) {
      void socket.join(`project:${projectId}`);
    }
  }

  emitMessage(audience: ChatAudience, message: unknown): void {
    if ('projectId' in audience) {
      this.server.to(`project:${audience.projectId}`).emit('chat:new', message);
    } else {
      for (const userId of audience.userIds) {
        this.server.to(`user:${userId}`).emit('chat:new', message);
      }
    }
  }
}
