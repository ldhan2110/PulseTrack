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
      groupBy: vi.fn(),
    },
    projectMember: {
      findMany: vi.fn(),
    },
    timeLog: {
      groupBy: vi.fn(),
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

  describe('getMemberPerformance()', () => {
    it('returns aggregated performance data per member', async () => {
      const projectId = 'proj-1';

      // Mock project members
      mockPrismaService.projectMember.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          user: { id: 'user-1', name: 'John Doe', imageUrl: null },
        },
        {
          userId: 'user-2',
          user: { id: 'user-2', name: 'Sarah Adams', imageUrl: 'https://example.com/sarah.jpg' },
        },
      ]);

      // Mock workflow statuses (TASK kind)
      mockPrismaService.workflowStatus.findMany.mockResolvedValue([
        { id: 'ws-backlog', isClosed: false },
        { id: 'ws-in-progress', isClosed: false },
        { id: 'ws-done', isClosed: true },
      ]);

      // Mock tasks grouped by [assigneeId, workflowStatusId]
      mockPrismaService.task.groupBy.mockResolvedValue([
        { assigneeId: 'user-1', workflowStatusId: 'ws-done', _count: 10 },
        { assigneeId: 'user-1', workflowStatusId: 'ws-in-progress', _count: 3 },
        { assigneeId: 'user-1', workflowStatusId: 'ws-backlog', _count: 2 },
        { assigneeId: 'user-2', workflowStatusId: 'ws-done', _count: 7 },
        { assigneeId: 'user-2', workflowStatusId: 'ws-in-progress', _count: 1 },
      ]);

      // Mock time logs grouped by userId
      mockPrismaService.timeLog.groupBy.mockResolvedValue([
        { userId: 'user-1', _sum: { minutes: 4800 } },  // 80 hours
        { userId: 'user-2', _sum: { minutes: 2700 } },  // 45 hours
      ]);

      // Mock bugs grouped by assigneeId
      mockPrismaService.bug.groupBy.mockResolvedValue([
        { assigneeId: 'user-1', _count: 2 },
        { assigneeId: 'user-2', _count: 5 },
      ]);

      const result = await service.getMemberPerformance(projectId);

      expect(result.members).toHaveLength(2);

      // User-1: 10 completed, 5 in-progress (3 in-progress + 2 backlog), 0 todo, 80h, 8h/task avg, 2 bugs
      const user1 = result.members.find((m) => m.userId === 'user-1')!;
      expect(user1.name).toBe('John Doe');
      expect(user1.tasks.completed).toBe(10);
      expect(user1.tasks.inProgress).toBe(5);
      expect(user1.tasks.todo).toBe(0);
      expect(user1.hoursLogged).toBe(80);
      expect(user1.avgHoursPerTask).toBe(8);
      expect(user1.bugCount).toBe(2);
      expect(user1.qualityRatio).toBeCloseTo(0.2);

      // User-2: 7 completed, 1 in-progress, 0 todo, 45h, ~6.43h/task avg, 5 bugs
      const user2 = result.members.find((m) => m.userId === 'user-2')!;
      expect(user2.tasks.completed).toBe(7);
      expect(user2.tasks.inProgress).toBe(1);
      expect(user2.tasks.todo).toBe(0);
      expect(user2.hoursLogged).toBe(45);
      expect(user2.avgHoursPerTask).toBeCloseTo(6.43, 1);
      expect(user2.bugCount).toBe(5);

      // Team avg = total hours / total completed = 125 / 17 = ~7.35
      expect(result.teamAvgHoursPerTask).toBeCloseTo(7.35, 1);

      // Default sort: by completed count descending
      expect(result.members[0].userId).toBe('user-1');
      expect(result.members[1].userId).toBe('user-2');
    });

    it('handles members with zero completed tasks', async () => {
      const projectId = 'proj-1';

      mockPrismaService.projectMember.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          user: { id: 'user-1', name: 'New Dev', imageUrl: null },
        },
      ]);

      mockPrismaService.workflowStatus.findMany.mockResolvedValue([
        { id: 'ws-backlog', isClosed: false },
        { id: 'ws-done', isClosed: true },
      ]);

      mockPrismaService.task.groupBy.mockResolvedValue([
        { assigneeId: 'user-1', workflowStatusId: 'ws-backlog', _count: 5 },
      ]);

      mockPrismaService.timeLog.groupBy.mockResolvedValue([]);
      mockPrismaService.bug.groupBy.mockResolvedValue([]);

      const result = await service.getMemberPerformance(projectId);

      const user = result.members[0];
      expect(user.tasks.completed).toBe(0);
      expect(user.tasks.inProgress).toBe(5);
      expect(user.tasks.todo).toBe(0);
      expect(user.hoursLogged).toBe(0);
      expect(user.avgHoursPerTask).toBe(0);
      expect(user.bugCount).toBe(0);
      expect(user.qualityRatio).toBe(0);
      expect(result.teamAvgHoursPerTask).toBe(0);
    });
  });
});
