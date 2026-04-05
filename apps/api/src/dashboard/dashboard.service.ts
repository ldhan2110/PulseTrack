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
    const [taskGroups, activeSprint, recentTasks, recentBugs, bugCounts] =
      await Promise.all([
        this.prisma.task.groupBy({
          by: ['status'],
          where: { projectId },
          _count: true,
        }),
        this.prisma.sprint.findFirst({
          where: { projectId, status: 'ACTIVE' },
          include: {
            tasks: {
              select: { storyPoints: true, status: true },
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
            creator: { select: { username: true } },
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
            reporter: { select: { username: true } },
          },
        }),
        Promise.all([
          this.prisma.bug.count({ where: { projectId } }),
          this.prisma.bug.count({ where: { projectId, status: 'OPEN' } }),
          this.prisma.bug.count({ where: { projectId, severity: 'CRITICAL' } }),
        ]),
      ]);

    // Build task counts by status
    const taskCounts = {
      total: 0,
      backlog: 0,
      inProgress: 0,
      inReview: 0,
      done: 0,
      blocked: 0,
    };

    for (const group of taskGroups) {
      const count = group._count;
      taskCounts.total += count;
      switch (group.status) {
        case 'BACKLOG':
          taskCounts.backlog = count;
          break;
        case 'IN_PROGRESS':
          taskCounts.inProgress = count;
          break;
        case 'IN_REVIEW':
          taskCounts.inReview = count;
          break;
        case 'DONE':
          taskCounts.done = count;
          break;
        case 'BLOCKED':
          taskCounts.blocked = count;
          break;
      }
    }

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
      const completedPoints = activeSprint.tasks
        .filter((t) => t.status === 'DONE')
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
        select: { storyPoints: true, status: true, updatedAt: true },
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

      const doneTasks = sprintTasks.filter((t) => t.status === 'DONE');

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
}
