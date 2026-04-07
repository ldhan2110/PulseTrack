import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTimeLogDto } from './dto/create-time-log.dto';

@Injectable()
export class TimeLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(projectId: string, taskId: string, userId: string, dto: CreateTimeLogDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, taskKey: true, _count: { select: { children: true } } },
    });

    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Task not found');
    }

    if (task._count.children > 0) {
      throw new BadRequestException('Cannot log time on a task that has sub-tasks. Log time on sub-tasks instead.');
    }

    const timeLog = await this.prisma.timeLog.create({
      data: {
        minutes: dto.minutes,
        comment: dto.comment,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
        taskId,
        userId,
      },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });

    const hours = Math.floor(dto.minutes / 60);
    const mins = dto.minutes % 60;
    const formatted = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;

    await this.prisma.taskHistory.create({
      data: {
        taskId,
        actorId: userId,
        field: 'timeLog',
        oldValue: null,
        newValue: `${formatted}${dto.comment ? ` — ${dto.comment}` : ''}`,
      },
    });

    this.notifications.notifyProject(projectId, 'task:updated', { projectId, taskId, task: { id: taskId } });

    return timeLog;
  }

  async findAll(taskId: string) {
    return this.prisma.timeLog.findMany({
      where: { taskId },
      orderBy: { loggedAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async remove(projectId: string, taskId: string, timeLogId: string, userId: string, userRole: string) {
    const timeLog = await this.prisma.timeLog.findUnique({
      where: { id: timeLogId },
      select: { id: true, userId: true, taskId: true, task: { select: { projectId: true } } },
    });

    if (!timeLog || timeLog.taskId !== taskId || timeLog.task.projectId !== projectId) {
      throw new NotFoundException('Time log not found');
    }

    if (timeLog.userId !== userId && userRole !== 'pm') {
      throw new ForbiddenException('Only the author or a PM can delete time logs');
    }

    await this.prisma.timeLog.delete({ where: { id: timeLogId } });

    this.notifications.notifyProject(projectId, 'task:updated', { projectId, taskId, task: { id: taskId } });
  }
}
