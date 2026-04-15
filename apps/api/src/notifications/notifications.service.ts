import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Server } from 'socket.io';
import type { Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private server: Server;

  constructor(
    private prisma: PrismaService,
    @InjectQueue('notification-email') private emailQueue: Queue,
  ) {}

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

    // Use individual creates to get back notification IDs for email jobs
    const created = await Promise.all(
      data.map((d) => this.prisma.notification.create({ data: d })),
    );

    for (const n of created) {
      this.notifyUser(n.recipientId, 'notification:new', n);
    }

    // Enqueue email jobs if project has email enabled
    const projectId = data[0].projectId;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { emailNotificationsEnabled: true },
    });
    if (!project?.emailNotificationsEnabled) {
      this.logger.debug(`Email notifications disabled for project ${projectId}, skipping email queue`);
      return;
    }

    const recipientIds = created.map((n) => n.recipientId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, email: true, name: true, username: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    this.logger.log(`Enqueuing ${created.length} email job(s) for project ${projectId}`);
    for (const n of created) {
      const user = userMap.get(n.recipientId);
      if (!user) {
        this.logger.warn(`Recipient ${n.recipientId} not found, skipping email for notification ${n.id}`);
        continue;
      }
      const job = await this.emailQueue.add('send', {
        notificationId: n.id,
        recipientEmail: user.email,
        recipientName: user.name ?? user.username,
      });
      this.logger.log(`Email job queued | jobId=${job.id} | notificationId=${n.id} | type=${n.type} | to=${user.email}`);
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
