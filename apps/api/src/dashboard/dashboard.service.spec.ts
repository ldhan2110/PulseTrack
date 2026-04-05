import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockPrismaService = {
    task: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    sprint: {
      findFirst: vi.fn(),
    },
    bug: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DashboardService(mockPrismaService as any);
  });

  describe('getProjectDashboard()', () => {
    it('returns correct task counts by status', async () => {
      const projectId = 'proj-1';

      mockPrismaService.task.groupBy.mockResolvedValue([
        { status: 'BACKLOG', _count: 5 },
        { status: 'IN_PROGRESS', _count: 3 },
        { status: 'IN_REVIEW', _count: 1 },
        { status: 'DONE', _count: 8 },
        { status: 'BLOCKED', _count: 2 },
      ]);
      mockPrismaService.sprint.findFirst.mockResolvedValue(null);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.bug.findMany.mockResolvedValue([]);
      mockPrismaService.bug.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(4)  // open
        .mockResolvedValueOnce(2); // critical

      const result = await service.getProjectDashboard(projectId);

      expect(result.taskCounts).toEqual({
        total: 19,
        backlog: 5,
        inProgress: 3,
        inReview: 1,
        done: 8,
        blocked: 2,
      });
    });

    it('returns null activeSprint when no active sprint exists', async () => {
      const projectId = 'proj-1';

      mockPrismaService.task.groupBy.mockResolvedValue([]);
      mockPrismaService.sprint.findFirst.mockResolvedValue(null);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.bug.findMany.mockResolvedValue([]);
      mockPrismaService.bug.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getProjectDashboard(projectId);

      expect(result.activeSprint).toBeNull();
      expect(result.burndown).toEqual([]);
    });

    it('returns active sprint progress when active sprint exists', async () => {
      const projectId = 'proj-1';
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-14');

      mockPrismaService.task.groupBy.mockResolvedValue([]);
      mockPrismaService.sprint.findFirst.mockResolvedValue({
        id: 'sprint-1',
        name: 'Sprint 1',
        startDate,
        endDate,
        status: 'ACTIVE',
        tasks: [
          { storyPoints: 5, status: 'DONE' },
          { storyPoints: 3, status: 'IN_PROGRESS' },
          { storyPoints: 8, status: 'BACKLOG' },
        ],
      });
      mockPrismaService.task.findMany
        .mockResolvedValueOnce([]) // recentTasks
        .mockResolvedValueOnce([ // burndown tasks
          { storyPoints: 5, status: 'DONE', updatedAt: new Date('2026-04-05') },
          { storyPoints: 3, status: 'IN_PROGRESS', updatedAt: new Date() },
          { storyPoints: 8, status: 'BACKLOG', updatedAt: new Date() },
        ]);
      mockPrismaService.bug.findMany.mockResolvedValue([]);
      mockPrismaService.bug.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getProjectDashboard(projectId);

      expect(result.activeSprint).not.toBeNull();
      expect(result.activeSprint!.id).toBe('sprint-1');
      expect(result.activeSprint!.totalPoints).toBe(16);
      expect(result.activeSprint!.completedPoints).toBe(5);
      expect(result.activeSprint!.remainingPoints).toBe(11);
    });

    it('returns burndown with ideal as linear decrease from totalPoints to 0', async () => {
      const projectId = 'proj-1';
      // 2-day sprint so we can easily verify the math
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-03');

      mockPrismaService.task.groupBy.mockResolvedValue([]);
      mockPrismaService.sprint.findFirst.mockResolvedValue({
        id: 'sprint-1',
        name: 'Sprint 1',
        startDate,
        endDate,
        status: 'ACTIVE',
        tasks: [
          { storyPoints: 10, status: 'IN_PROGRESS' },
        ],
      });
      mockPrismaService.task.findMany
        .mockResolvedValueOnce([]) // recentTasks
        .mockResolvedValueOnce([ // burndown tasks
          { storyPoints: 10, status: 'IN_PROGRESS', updatedAt: new Date('2026-04-02') },
        ]);
      mockPrismaService.bug.findMany.mockResolvedValue([]);
      mockPrismaService.bug.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getProjectDashboard(projectId);

      expect(result.burndown.length).toBeGreaterThan(0);
      // First point: day 0, ideal = totalPoints (10), actual = totalPoints (nothing done yet)
      expect(result.burndown[0].date).toBe('2026-04-01');
      expect(result.burndown[0].ideal).toBe(10);
      // Last point: day N, ideal = 0 (linear decrease to 0)
      const lastPoint = result.burndown[result.burndown.length - 1];
      expect(lastPoint.ideal).toBe(0);
    });

    it('returns correct bug counts', async () => {
      const projectId = 'proj-1';

      mockPrismaService.task.groupBy.mockResolvedValue([]);
      mockPrismaService.sprint.findFirst.mockResolvedValue(null);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.bug.findMany.mockResolvedValue([]);
      mockPrismaService.bug.count
        .mockResolvedValueOnce(15) // total
        .mockResolvedValueOnce(7)  // open
        .mockResolvedValueOnce(3); // critical

      const result = await service.getProjectDashboard(projectId);

      expect(result.bugCounts).toEqual({
        total: 15,
        open: 7,
        critical: 3,
      });
    });
  });
});
