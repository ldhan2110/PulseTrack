import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;

  // Workflow statuses returned by the first workflowStatus.findMany call (TASK statuses)
  const mockWorkflowStatuses = [
    { id: 'ws-backlog', name: 'Backlog', key: 'BACKLOG', color: '#ccc', isClosed: false },
    { id: 'ws-in-progress', name: 'In Progress', key: 'IN_PROGRESS', color: '#36f', isClosed: false },
    { id: 'ws-in-review', name: 'In Review', key: 'IN_REVIEW', color: '#f90', isClosed: false },
    { id: 'ws-done', name: 'Done', key: 'DONE', color: '#0c0', isClosed: true },
    { id: 'ws-blocked', name: 'Blocked', key: 'BLOCKED', color: '#c00', isClosed: false },
  ];

  // Bug workflow statuses returned by the second workflowStatus.findMany call
  const mockBugWorkflowStatuses = [
    { id: 'bws-open', isClosed: false },
    { id: 'bws-closed', isClosed: true },
  ];

  const mockPrismaService = {
    workflowStatus: {
      findMany: vi.fn(),
    },
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

  /**
   * Helper to set up default mocks for the workflowStatus.findMany calls.
   * The service calls it twice:
   *   1) All statuses for the project (ordered by position)
   *   2) BUG-kind statuses for bug count computation
   */
  function setupWorkflowStatusMocks() {
    mockPrismaService.workflowStatus.findMany
      .mockResolvedValueOnce(mockWorkflowStatuses) // first call: all project statuses
      .mockResolvedValueOnce(mockBugWorkflowStatuses); // second call: BUG kind statuses
  }

  describe('getProjectDashboard()', () => {
    it('returns correct task counts by workflow status', async () => {
      const projectId = 'proj-1';

      setupWorkflowStatusMocks();
      mockPrismaService.task.groupBy.mockResolvedValue([
        { workflowStatusId: 'ws-backlog', _count: 5 },
        { workflowStatusId: 'ws-in-progress', _count: 3 },
        { workflowStatusId: 'ws-in-review', _count: 1 },
        { workflowStatusId: 'ws-done', _count: 8 },
        { workflowStatusId: 'ws-blocked', _count: 2 },
      ]);
      mockPrismaService.sprint.findFirst.mockResolvedValue(null);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.bug.findMany.mockResolvedValue([]);
      mockPrismaService.bug.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(4)  // open
        .mockResolvedValueOnce(2); // critical

      const result = await service.getProjectDashboard(projectId);

      expect(result.taskCounts.total).toBe(19);
      expect(result.taskCounts.byStatus).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'BACKLOG', count: 5 }),
          expect.objectContaining({ key: 'IN_PROGRESS', count: 3 }),
          expect.objectContaining({ key: 'IN_REVIEW', count: 1 }),
          expect.objectContaining({ key: 'DONE', count: 8 }),
          expect.objectContaining({ key: 'BLOCKED', count: 2 }),
        ]),
      );
    });

    it('returns null activeSprint when no active sprint exists', async () => {
      const projectId = 'proj-1';

      setupWorkflowStatusMocks();
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

      setupWorkflowStatusMocks();
      mockPrismaService.task.groupBy.mockResolvedValue([]);
      mockPrismaService.sprint.findFirst.mockResolvedValue({
        id: 'sprint-1',
        name: 'Sprint 1',
        startDate,
        endDate,
        status: 'ACTIVE',
        tasks: [
          { storyPoints: 5, workflowStatusId: 'ws-done' },
          { storyPoints: 3, workflowStatusId: 'ws-in-progress' },
          { storyPoints: 8, workflowStatusId: 'ws-backlog' },
        ],
      });
      mockPrismaService.task.findMany
        .mockResolvedValueOnce([]) // recentTasks
        .mockResolvedValueOnce([ // burndown tasks
          { storyPoints: 5, workflowStatusId: 'ws-done', updatedAt: new Date('2026-04-05') },
          { storyPoints: 3, workflowStatusId: 'ws-in-progress', updatedAt: new Date() },
          { storyPoints: 8, workflowStatusId: 'ws-backlog', updatedAt: new Date() },
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

      setupWorkflowStatusMocks();
      mockPrismaService.task.groupBy.mockResolvedValue([]);
      mockPrismaService.sprint.findFirst.mockResolvedValue({
        id: 'sprint-1',
        name: 'Sprint 1',
        startDate,
        endDate,
        status: 'ACTIVE',
        tasks: [
          { storyPoints: 10, workflowStatusId: 'ws-in-progress' },
        ],
      });
      mockPrismaService.task.findMany
        .mockResolvedValueOnce([]) // recentTasks
        .mockResolvedValueOnce([ // burndown tasks
          { storyPoints: 10, workflowStatusId: 'ws-in-progress', updatedAt: new Date('2026-04-02') },
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

      setupWorkflowStatusMocks();
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
