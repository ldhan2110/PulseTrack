import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketAuthService } from './socket-auth.service';
import { NotificationsService } from './notifications.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly socketAuthService: SocketAuthService,
    private readonly notificationsService: NotificationsService,
  ) {}

  afterInit(server: Server): void {
    this.notificationsService.setServer(server);
  }

  async handleConnection(socket: Socket): Promise<void> {
    const userId = await this.socketAuthService.extractUserFromHandshake(
      socket.handshake,
    );

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.data.userId = userId;
    await socket.join(`user:${userId}`);
  }

  handleDisconnect(_socket: Socket): void {
    // Socket.IO automatically removes the socket from all rooms on disconnect.
  }
}
