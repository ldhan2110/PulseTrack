import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EntityType } from '@prisma/client';

@Injectable()
export class WatchersService {
  constructor(private prisma: PrismaService) {}

  async findAll(entityType: EntityType, entityId: string) {
    return this.prisma.ticketWatcher.findMany({
      where: { entityType, entityId },
      include: {
        user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
    });
  }

  async addWatchers(entityType: EntityType, entityId: string, userIds: string[], actorId?: string) {
    const result = await this.prisma.ticketWatcher.createMany({
      data: userIds.map((userId) => ({ entityType, entityId, userId })),
      skipDuplicates: true,
    });

    if (actorId && entityType === 'TASK' && userIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, username: true },
      });
      const names = users.map((u) => u.name ?? u.username).join(', ');
      await this.prisma.taskHistory.create({
        data: {
          taskId: entityId,
          actorId,
          field: 'watcher_added',
          oldValue: null,
          newValue: names,
        },
      });
    }

    return result;
  }

  async removeWatcher(entityType: EntityType, entityId: string, userId: string, actorId?: string) {
    let removedUserName: string | null = null;
    if (actorId && entityType === 'TASK') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, username: true },
      });
      removedUserName = user?.name ?? user?.username ?? null;
    }

    const result = await this.prisma.ticketWatcher.deleteMany({
      where: { entityType, entityId, userId },
    });

    if (actorId && entityType === 'TASK' && removedUserName) {
      await this.prisma.taskHistory.create({
        data: {
          taskId: entityId,
          actorId,
          field: 'watcher_removed',
          oldValue: removedUserName,
          newValue: null,
        },
      });
    }

    return result;
  }

  async getWatcherUserIds(entityType: EntityType, entityId: string): Promise<string[]> {
    const watchers = await this.prisma.ticketWatcher.findMany({
      where: { entityType, entityId },
      select: { userId: true },
    });
    return watchers.map((w) => w.userId);
  }
}
