import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { hasPermission, type RolePermissions } from '../auth/permissions';

@Injectable()
export class TimeLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(projectId: string, taskId: string, userId: string, dto: CreateTimeLogDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, taskKey: true, progress: true, estimatedMinutes: true, _count: { select: { children: true } } },
    });

    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Task not found');
    }

    if (task._count.children > 0) {
      throw new BadRequestException('Cannot log time on a task that has sub-tasks. Log time on sub-tasks instead.');
    }

    if (!task.estimatedMinutes) {
      throw new BadRequestException('Cannot log time without an estimate. Please set an estimate first.');
    }

    const [timeLog] = await this.prisma.$transaction([
      this.prisma.timeLog.create({
        data: {
          minutes: dto.minutes,
          comment: dto.comment,
          loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
          progress: dto.progress,
          taskId,
          userId,
        },
        include: {
          user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        },
      }),
      ...(dto.progress !== undefined
        ? [
            this.prisma.task.update({
              where: { id: taskId },
              data: { progress: dto.progress },
            }),
          ]
        : []),
    ]);

    const hours = Math.floor(dto.minutes / 60);
    const mins = dto.minutes % 60;
    const formatted = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;

    const historyValue = `${formatted}${dto.comment ? ` — ${dto.comment}` : ''}${dto.progress !== undefined ? ` (progress: ${dto.progress}%)` : ''}`;

    await this.prisma.taskHistory.create({
      data: {
        taskId,
        actorId: userId,
        field: 'timeLog',
        oldValue: null,
        newValue: historyValue,
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
        user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
    });
  }

  // Per-project timesheet: TimeLogs in [from, to] grouped by user → task, rolled into per-day hour buckets.
  async getTimesheet(projectId: string, from: Date, to: Date) {
    const MS_PER_DAY = 86_400_000;
    // Normalize to day boundaries so the bucket count matches the frontend's eachDayOfInterval.
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    const dayCount = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
    const days = Array.from({ length: dayCount }, (_, i) =>
      new Date(start.getTime() + i * MS_PER_DAY).toISOString().slice(0, 10),
    );

    const [members, logs] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { projectId },
        select: { user: { select: { id: true, name: true, imageUrl: true } } },
      }),
      this.prisma.timeLog.findMany({
        where: {
          task: { projectId },
          loggedAt: { gte: start, lt: new Date(end.getTime() + MS_PER_DAY) },
        },
        select: {
          minutes: true,
          loggedAt: true,
          user: { select: { id: true, name: true, imageUrl: true } },
          task: { select: { id: true, taskKey: true, title: true } },
        },
      }),
    ]);

    // user id → { user, tickets: Map<taskId, {key,title,values}> }
    const byUser = new Map<
      string,
      { user: { id: string; name: string | null; imageUrl: string | null }; tickets: Map<string, { key: string; title: string; values: number[] }> }
    >();

    // Seed every project member so users with 0 logged hours still appear as a row.
    for (const m of members) {
      byUser.set(m.user.id, { user: m.user, tickets: new Map() });
    }

    for (const log of logs) {
      const dayIndex = Math.floor(
        (new Date(log.loggedAt.getFullYear(), log.loggedAt.getMonth(), log.loggedAt.getDate()).getTime() - start.getTime()) / MS_PER_DAY,
      );
      if (dayIndex < 0 || dayIndex >= dayCount) continue;

      let u = byUser.get(log.user.id);
      if (!u) {
        u = { user: log.user, tickets: new Map() };
        byUser.set(log.user.id, u);
      }
      let ticket = u.tickets.get(log.task.id);
      if (!ticket) {
        ticket = { key: log.task.taskKey ?? log.task.id, title: log.task.title, values: Array(dayCount).fill(0) };
        u.tickets.set(log.task.id, ticket);
      }
      ticket.values[dayIndex] += log.minutes / 60;
    }

    const rows = Array.from(byUser.values()).map(({ user, tickets }) => {
      const ticketList = Array.from(tickets.values());
      const values = Array.from({ length: dayCount }, (_, i) => ticketList.reduce((s, t) => s + t.values[i], 0));
      return {
        user,
        tickets: ticketList,
        values,
        total: values.reduce((s, v) => s + v, 0),
      };
    });

    return { rows, days };
  }

  async remove(projectId: string, taskId: string, timeLogId: string, userId: string, permissions: RolePermissions) {
    const timeLog = await this.prisma.timeLog.findUnique({
      where: { id: timeLogId },
      select: { id: true, userId: true, taskId: true, task: { select: { projectId: true } } },
    });

    if (!timeLog || timeLog.taskId !== taskId || timeLog.task.projectId !== projectId) {
      throw new NotFoundException('Time log not found');
    }

    if (timeLog.userId !== userId && !hasPermission(permissions, 'tasks', 'delete')) {
      throw new ForbiddenException('Only the author or a PM can delete time logs');
    }

    await this.prisma.timeLog.delete({ where: { id: timeLogId } });

    this.notifications.notifyProject(projectId, 'task:updated', { projectId, taskId, task: { id: taskId } });
  }
}
