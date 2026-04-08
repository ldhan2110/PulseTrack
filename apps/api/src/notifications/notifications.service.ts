import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Server } from 'socket.io';
import type { Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private server: Server;

  constructor(private prisma: PrismaService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  notifyUser(userId: string, event: string, data: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  notifyProject(projectId: string, event: string, data: unknown): void {
    this.server?.to(`project:${projectId}`).emit(event, data);
  }

  async createMany(data: Prisma.NotificationCreateManyInput[]) {
    if (data.length === 0) return;
    await this.prisma.notification.createMany({ data });
    for (const n of data) {
      this.notifyUser(n.recipientId, 'notification:new', n);
    }
  }

  async findAll(
    recipientId: string,
    opts: { page?: number; limit?: number; isRead?: boolean; type?: string },
  ) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const where: Prisma.NotificationWhereInput = { recipientId };
    if (opts.isRead !== undefined) where.isRead = opts.isRead;
    if (opts.type) where.type = opts.type as any;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          actor: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, recipientId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(recipientId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
