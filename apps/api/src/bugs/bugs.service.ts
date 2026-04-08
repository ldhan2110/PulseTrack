import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WatchersService } from '../watchers/watchers.service';
import { CreateBugDto } from './dto/create-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';
import type { NotificationType, EntityType, Prisma } from '@prisma/client';

const BUG_RELATIONS = {
  reporter: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
  assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
  workflowStatus: true,
  reproSteps: { orderBy: { position: 'asc' as const } },
  parentTask: { select: { id: true, taskKey: true, title: true } },
};

@Injectable()
export class BugsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private watchersService: WatchersService,
    @InjectQueue('notification-email') private emailQueue: Queue,
  ) {}

  async create(projectId: string, reporterId: string, dto: CreateBugDto) {
    const initialStatus = await this.prisma.workflowStatus.findFirst({
      where: { projectId, kind: 'BUG', isDefault: true },
    });

    return this.prisma.$transaction(async (tx) => {
      // Atomically increment bugSeq to generate bugKey
      const project = await tx.project.update({
        where: { id: projectId },
        data: { bugSeq: { increment: 1 } },
        select: { prefix: true, bugSeq: true },
      });
      const bugKey = project.prefix ? `${project.prefix}-BUG-${project.bugSeq}` : null;

      const bug = await tx.bug.create({
        data: {
          projectId,
          reporterId,
          bugKey,
          title: dto.title,
          description: dto.description,
          severity: dto.severity,
          environment: dto.environment,
          expectedResult: dto.expectedResult,
          actualResult: dto.actualResult,
          assigneeId: dto.assigneeId,
          parentTaskId: dto.parentTaskId,
          workflowStatusId: initialStatus?.id ?? null,
        },
        include: BUG_RELATIONS,
      });

      if (dto.reproSteps?.length) {
        await tx.bugReproStep.createMany({
          data: dto.reproSteps.map((s) => ({
            bugId: bug.id,
            position: s.position,
            content: s.content,
          })),
        });
      }

      return tx.bug.findUniqueOrThrow({
        where: { id: bug.id },
        include: BUG_RELATIONS,
      });
    });
  }

  async findAll(projectId: string, filters?: {
    severity?: string;
    workflowStatusId?: string;
    assigneeId?: string;
    parentTaskId?: string;
    reporterId?: string;
    search?: string;
  }) {
    const where: any = { projectId };
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.workflowStatusId) where.workflowStatusId = filters.workflowStatusId;
    if (filters?.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters?.parentTaskId) where.parentTaskId = filters.parentTaskId;
    if (filters?.reporterId) where.reporterId = filters.reporterId;
    if (filters?.search) where.title = { contains: filters.search, mode: 'insensitive' };

    return this.prisma.bug.findMany({
      where,
      include: BUG_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(bugId: string) {
    return this.prisma.bug.findUnique({
      where: { id: bugId },
      include: {
        ...BUG_RELATIONS,
        attachments: {
          include: {
            uploader: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findByBugKey(bugKey: string) {
    return this.prisma.bug.findUnique({
      where: { bugKey },
      include: {
        ...BUG_RELATIONS,
        attachments: {
          include: {
            uploader: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async update(bugId: string, dto: UpdateBugDto) {
    return this.prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.severity !== undefined) data.severity = dto.severity;
      if (dto.environment !== undefined) data.environment = dto.environment;
      if (dto.expectedResult !== undefined) data.expectedResult = dto.expectedResult;
      if (dto.actualResult !== undefined) data.actualResult = dto.actualResult;
      if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
      if (dto.parentTaskId !== undefined) data.parentTaskId = dto.parentTaskId;
      if (dto.workflowStatusId !== undefined) data.workflowStatusId = dto.workflowStatusId;

      const bug = await tx.bug.update({
        where: { id: bugId },
        data,
        include: BUG_RELATIONS,
      });

      if (dto.reproSteps !== undefined) {
        await tx.bugReproStep.deleteMany({ where: { bugId } });
        if (dto.reproSteps.length > 0) {
          await tx.bugReproStep.createMany({
            data: dto.reproSteps.map((s) => ({
              bugId,
              position: s.position,
              content: s.content,
            })),
          });
        }
      }

      return tx.bug.findUniqueOrThrow({
        where: { id: bugId },
        include: BUG_RELATIONS,
      });
    });
  }

  async delete(bugId: string) {
    return this.prisma.bug.delete({ where: { id: bugId } });
  }

  private async triggerWatcherNotifications(opts: {
    projectId: string;
    entityId: string;
    entityTitle: string;
    type: NotificationType;
    actorId: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }) {
    const watcherIds = await this.watchersService.getWatcherUserIds('BUG' as EntityType, opts.entityId);
    const recipientIds = watcherIds.filter((id) => id !== opts.actorId);
    if (recipientIds.length === 0) return;

    const data = recipientIds.map((recipientId) => ({
      recipientId,
      projectId: opts.projectId,
      type: opts.type,
      entityType: 'BUG' as EntityType,
      entityId: opts.entityId,
      entityTitle: opts.entityTitle,
      actorId: opts.actorId,
      summary: opts.summary,
      metadata: opts.metadata ?? undefined,
    })) as Prisma.NotificationCreateManyInput[]; 
    await this.notifications.createMany(data);

    const project = await this.prisma.project.findUnique({
      where: { id: opts.projectId },
      select: { emailNotificationsEnabled: true },
    });
    if (project?.emailNotificationsEnabled) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, email: true, name: true, username: true },
      });
      for (const user of users) {
        await this.emailQueue.add('send', {
          notificationId: opts.entityId,
          recipientEmail: user.email,
          recipientName: user.name ?? user.username,
        });
      }
    }
  }
}
