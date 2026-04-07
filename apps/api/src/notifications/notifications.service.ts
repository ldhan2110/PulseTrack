import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class NotificationsService {
  private server: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  notifyUser(userId: string, event: string, data: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  notifyProject(projectId: string, event: string, data: unknown): void {
    this.server?.to(`project:${projectId}`).emit(event, data);
  }
}
