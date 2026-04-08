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

  async addWatchers(entityType: EntityType, entityId: string, userIds: string[]) {
    return this.prisma.ticketWatcher.createMany({
      data: userIds.map((userId) => ({ entityType, entityId, userId })),
      skipDuplicates: true,
    });
  }

  async removeWatcher(entityType: EntityType, entityId: string, userId: string) {
    return this.prisma.ticketWatcher.deleteMany({
      where: { entityType, entityId, userId },
    });
  }

  async getWatcherUserIds(entityType: EntityType, entityId: string): Promise<string[]> {
    const watchers = await this.prisma.ticketWatcher.findMany({
      where: { entityType, entityId },
      select: { userId: true },
    });
    return watchers.map((w) => w.userId);
  }
}
