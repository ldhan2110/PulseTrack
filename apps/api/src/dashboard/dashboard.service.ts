import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BurndownPoint {
  date: string;
  ideal: number;
  actual: number;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getProjectDashboard(projectId: string) {
    const [workflowStatuses, tasksByStatus, activeSprint, recentTasks, recentBugs, bugCounts] =
      await Promise.all([
        this.prisma.workflowStatus.findMany({
          where: { projectId, kind: 'TASK' },
          orderBy: { position: 'asc' },
          select: { id: true, name: true, key: true, color: true, isClosed: true },
        }),
        this.prisma.task.groupBy({
          by: ['workflowStatusId'],
          where: { projectId },
          _count: true,
        }),
        this.prisma.sprint.findFirst({
          where: { projectId, status: 'ACTIVE' },
          include: {
            tasks: {
              select: {
                storyPoints: true,
                workflowStatusId: true,
              },
            },
          },
        }),
        this.prisma.task.findMany({
          where: { projectId },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            creator: { select: { username: true, name: true, imageUrl: true } },
          },
        }),
        this.prisma.bug.findMany({
          where: { projectId },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            reporter: { select: { username: true, name: true, imageUrl: true } },
          },
        }),
        this.prisma.workflowStatus.findMany({
          where: { projectId, kind: 'BUG' },
          select: { id: true, isClosed: true },
        }).then(async (bugStatuses) => {
          const openStatusIds = bugStatuses.filter((s) => !s.isClosed).map((s) => s.id);
          const [total, open, critical] = await Promise.all([
            this.prisma.bug.count({ where: { projectId } }),
            this.prisma.bug.count({ where: { projectId, workflowStatusId: { in: openStatusIds } } }),
            this.prisma.bug.count({ where: { projectId, severity: 'CRITICAL' } }),
          ]);
          return [total, open, critical] as [number, number, number];
        }),
      ]);

    // Build task counts by workflow status
    const countByStatusId = new Map<string, number>();
    let orphaned = 0;
    let total = 0;

    for (const group of tasksByStatus) {
      const count = group._count;
      total += count;
      if (group.workflowStatusId === null) {
        orphaned += count;
      } else {
        countByStatusId.set(group.workflowStatusId, count);
      }
    }

    const byStatus = workflowStatuses.map((ws) => ({
      statusId: ws.id,
      name: ws.name,
      key: ws.key,
      color: ws.color,
      isClosed: ws.isClosed,
      count: countByStatusId.get(ws.id) ?? 0,
    }));

    const taskCounts = { total, byStatus, orphaned };

    // Build active sprint data
    let activeSprintData: {
      id: string;
      name: string;
      startDate: string;
      endDate: string;
      totalPoints: number;
      completedPoints: number;
      remainingPoints: number;
    } | null = null;

    if (activeSprint) {
      const totalPoints = activeSprint.tasks.reduce(
        (sum, t) => sum + (t.storyPoints ?? 0),
        0,
      );
      const closedStatusIds = new Set(
        workflowStatuses.filter((ws) => ws.isClosed).map((ws) => ws.id),
      );
      const completedPoints = activeSprint.tasks
        .filter((t) => t.workflowStatusId !== null && closedStatusIds.has(t.workflowStatusId))
        .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

      activeSprintData = {
        id: activeSprint.id,
        name: activeSprint.name,
        startDate: activeSprint.startDate.toISOString(),
        endDate: activeSprint.endDate.toISOString(),
        totalPoints,
        completedPoints,
        remainingPoints: totalPoints - completedPoints,
      };
    }

    // Build recent activity feed (merge tasks + bugs, sort by updatedAt)
    const taskActivity = recentTasks.map((t) => ({
      id: t.id,
      type: 'task' as const,
      title: t.title,
      actor: t.creator.username,
      timestamp: t.updatedAt.toISOString(),
    }));

    const bugActivity = recentBugs.map((b) => ({
      id: b.id,
      type: 'bug' as const,
      title: b.title,
      actor: b.reporter.username,
      timestamp: b.updatedAt.toISOString(),
    }));

    const recentActivity = [...taskActivity, ...bugActivity]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 20);

    // Build burndown data
    // POC approximation — uses updatedAt for completion date. Production would use TaskStatusHistory table.
    const burndown: BurndownPoint[] = [];

    if (activeSprint) {
      const sprintTasks = await this.prisma.task.findMany({
        where: { sprintId: activeSprint.id },
        select: { storyPoints: true, workflowStatusId: true, updatedAt: true },
      });

      const totalPoints = sprintTasks.reduce(
        (sum, t) => sum + (t.storyPoints ?? 0),
        0,
      );

      const startDate = activeSprint.startDate;
      const endDate = activeSprint.endDate;
      const totalDays = Math.max(
        1,
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      const burndownClosedIds = new Set(
        workflowStatuses.filter((ws) => ws.isClosed).map((ws) => ws.id),
      );
      const doneTasks = sprintTasks.filter(
        (t) => t.workflowStatusId !== null && burndownClosedIds.has(t.workflowStatusId),
      );

      for (let dayIndex = 0; dayIndex <= totalDays; dayIndex++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + dayIndex);
        const dateStr = date.toISOString().split('T')[0];

        // Ideal: linear decrease from totalPoints to 0
        const ideal = Math.round(
          totalPoints * (1 - dayIndex / totalDays),
        );

        // Actual: remaining points = total - points completed by this date
        const completedByDate = doneTasks
          .filter((t) => t.updatedAt <= date)
          .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
        const actual = totalPoints - completedByDate;

        burndown.push({ date: dateStr, ideal, actual });
      }
    }

    // Bug counts
    const [totalBugs, openBugs, criticalBugs] = bugCounts;
    const bugCountData = {
      total: totalBugs,
      open: openBugs,
      critical: criticalBugs,
    };

    return {
      taskCounts,
      activeSprint: activeSprintData,
      recentActivity,
      burndown,
      bugCounts: bugCountData,
    };
  }

  async getMemberPerformance(projectId: string, timeFilter?: 'sprint' | '7d' | '30d') {
    // Build date filter
    let dateFilter: { gte: Date } | undefined;
    let sprintFilter: { sprintId: string } | undefined;

    if (timeFilter === '7d') {
      dateFilter = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    } else if (timeFilter === '30d') {
      dateFilter = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    } else if (timeFilter === 'sprint') {
      const activeSprint = await this.prisma.sprint.findFirst({
        where: { projectId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (activeSprint) {
        sprintFilter = { sprintId: activeSprint.id };
      }
    }

    const taskWhere: Record<string, unknown> = { projectId, assigneeId: { not: null } };
    if (dateFilter) taskWhere.updatedAt = dateFilter;
    if (sprintFilter) taskWhere.sprintId = sprintFilter.sprintId;

    const timeLogWhere: Record<string, unknown> = { task: { projectId } };
    if (dateFilter) timeLogWhere.loggedAt = dateFilter;
    if (sprintFilter) timeLogWhere.task = { projectId, sprintId: sprintFilter.sprintId };

    const bugWhere: Record<string, unknown> = { projectId, assigneeId: { not: null } };
    if (dateFilter) bugWhere.createdAt = dateFilter;

    const [members, workflowStatuses, taskGroups, timeGroups, bugGroups] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { projectId },
        select: {
          userId: true,
          user: { select: { id: true, name: true, imageUrl: true } },
        },
      }),
      this.prisma.workflowStatus.findMany({
        where: { projectId, kind: 'TASK' },
        select: { id: true, isClosed: true },
      }),
      this.prisma.task.groupBy({
        by: ['assigneeId', 'workflowStatusId'],
        where: taskWhere,
        _count: true,
      }),
      this.prisma.timeLog.groupBy({
        by: ['userId'],
        where: timeLogWhere,
        _sum: { minutes: true },
      }),
      this.prisma.bug.groupBy({
        by: ['assigneeId'],
        where: bugWhere,
        _count: true,
      }),
    ]);

    const closedStatusIds = new Set(workflowStatuses.filter((ws) => ws.isClosed).map((ws) => ws.id));

    // Build lookup maps
    const timeByUser = new Map(timeGroups.map((t) => [t.userId, t._sum.minutes ?? 0]));
    const bugsByUser = new Map(bugGroups.map((b) => [b.assigneeId, b._count]));

    // Aggregate tasks per member
    const tasksByUser = new Map<string, { completed: number; inProgress: number; todo: number }>();
    for (const group of taskGroups) {
      if (!group.assigneeId) continue;
      const entry = tasksByUser.get(group.assigneeId) ?? { completed: 0, inProgress: 0, todo: 0 };
      if (group.workflowStatusId && closedStatusIds.has(group.workflowStatusId)) {
        entry.completed += group._count;
      } else if (group.workflowStatusId) {
        entry.inProgress += group._count;
      } else {
        entry.todo += group._count;
      }
      tasksByUser.set(group.assigneeId, entry);
    }

    let totalCompleted = 0;
    let totalHours = 0;

    const rows = members.map((member) => {
      const tasks = tasksByUser.get(member.userId) ?? { completed: 0, inProgress: 0, todo: 0 };
      const minutes = timeByUser.get(member.userId) ?? 0;
      const hoursLogged = Math.round((minutes / 60) * 100) / 100;
      const bugCount = bugsByUser.get(member.userId) ?? 0;
      const avgHoursPerTask = tasks.completed > 0 ? Math.round((hoursLogged / tasks.completed) * 100) / 100 : 0;
      const qualityRatio = tasks.completed > 0 ? Math.round((bugCount / tasks.completed) * 100) / 100 : 0;

      totalCompleted += tasks.completed;
      totalHours += hoursLogged;

      return {
        userId: member.userId,
        name: member.user.name ?? member.user.id,
        imageUrl: member.user.imageUrl,
        tasks: { ...tasks, total: tasks.completed + tasks.inProgress + tasks.todo },
        hoursLogged,
        avgHoursPerTask,
        bugCount,
        qualityRatio,
      };
    });

    // Sort by completed count descending
    rows.sort((a, b) => b.tasks.completed - a.tasks.completed);

    const teamAvgHoursPerTask = totalCompleted > 0
      ? Math.round((totalHours / totalCompleted) * 100) / 100
      : 0;

    return { members: rows, teamAvgHoursPerTask };
  }
}
