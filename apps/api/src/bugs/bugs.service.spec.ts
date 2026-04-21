import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BugsService } from './bugs.service';

describe('BugsService', () => {
  let service: BugsService;

  const mockTx = {
    bug: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    bugReproStep: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    project: {
      update: vi.fn().mockResolvedValue({ prefix: 'PM', bugSeq: 1 }),
    },
  };

  const mockPrismaService = {
    bug: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    workflowStatus: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  };

  const defaultWorkflowStatus = {
    id: 'ws-open',
    name: 'Open',
    kind: 'BUG',
    isDefault: true,
  };

  const userSelect = { id: true, username: true, email: true, name: true, imageUrl: true };

  const BUG_RELATIONS = {
    reporter: { select: userSelect },
    assignee: { select: userSelect },
    workflowStatus: true,
    reproSteps: { orderBy: { position: 'asc' as const } },
    parentTask: { select: { id: true, taskKey: true, title: true } },
  };

  const mockNotificationsService = { createMany: vi.fn(), notifyProject: vi.fn() };
  const mockWatchersService = { getWatcherUserIds: vi.fn().mockResolvedValue([]) };
  const mockEmailQueue = { add: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BugsService(
      mockPrismaService as any,
      mockNotificationsService as any,
      mockWatchersService as any,
      {} as any,
    );
    mockPrismaService.workflowStatus.findFirst.mockResolvedValue(defaultWorkflowStatus);
  });

  describe('create()', () => {
    it('creates a bug with reporterId and initial workflow status', async () => {
      const projectId = 'proj-1';
      const reporterId = 'user-1';
      const dto = {
        title: 'Login button not working',
        severity: 'HIGH' as any,
      };
      const createdBug = {
        id: 'bug-1',
        projectId,
        reporterId,
        title: dto.title,
        severity: 'HIGH',
        workflowStatusId: 'ws-open',
        workflowStatus: defaultWorkflowStatus,
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com', name: 'QC', imageUrl: null },
        assignee: null,
        reproSteps: [],
        parentTask: null,
      };

      mockTx.bug.create.mockResolvedValue(createdBug);
      mockTx.bug.findUniqueOrThrow.mockResolvedValue(createdBug);

      const result = await service.create(projectId, reporterId, dto);

      expect(result.reporterId).toBe(reporterId);
      expect(result.workflowStatusId).toBe('ws-open');
      expect(mockPrismaService.workflowStatus.findFirst).toHaveBeenCalledWith({
        where: { projectId, kind: 'BUG', isDefault: true },
      });
      expect(mockTx.bug.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId,
            reporterId,
            title: dto.title,
            workflowStatusId: 'ws-open',
          }),
          include: BUG_RELATIONS,
        }),
      );
    });

    it('creates bug with CRITICAL severity', async () => {
      const projectId = 'proj-1';
      const reporterId = 'user-1';
      const dto = {
        title: 'Database connection fails',
        severity: 'CRITICAL' as any,
        description: 'Cannot connect to DB',
      };
      const createdBug = {
        id: 'bug-2',
        projectId,
        reporterId,
        title: dto.title,
        severity: 'CRITICAL',
        workflowStatusId: 'ws-open',
        workflowStatus: defaultWorkflowStatus,
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com', name: 'QC', imageUrl: null },
        assignee: null,
        reproSteps: [],
        parentTask: null,
      };

      mockTx.bug.create.mockResolvedValue(createdBug);
      mockTx.bug.findUniqueOrThrow.mockResolvedValue(createdBug);

      const result = await service.create(projectId, reporterId, dto);

      expect(result.severity).toBe('CRITICAL');
    });

    it('creates bug with reproduction steps', async () => {
      const projectId = 'proj-1';
      const reporterId = 'user-1';
      const dto = {
        title: 'Crash on save',
        severity: 'HIGH' as any,
        reproSteps: [
          { position: 0, content: 'Open the editor' },
          { position: 1, content: 'Click save' },
          { position: 2, content: 'Observe crash' },
        ],
      };
      const createdBugInitial = {
        id: 'bug-3',
        projectId,
        reporterId,
        title: dto.title,
        severity: 'HIGH',
        workflowStatusId: 'ws-open',
        workflowStatus: defaultWorkflowStatus,
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com', name: 'QC', imageUrl: null },
        assignee: null,
        reproSteps: [],
        parentTask: null,
      };
      const createdBugFinal = {
        ...createdBugInitial,
        reproSteps: dto.reproSteps.map((s, i) => ({ id: `step-${i}`, bugId: 'bug-3', ...s })),
      };

      mockTx.bug.create.mockResolvedValue(createdBugInitial);
      mockTx.bugReproStep.createMany.mockResolvedValue({ count: 3 });
      mockTx.bug.findUniqueOrThrow.mockResolvedValue(createdBugFinal);

      const result = await service.create(projectId, reporterId, dto);

      expect(result.reproSteps).toHaveLength(3);
      expect(mockTx.bugReproStep.createMany).toHaveBeenCalledWith({
        data: dto.reproSteps.map((s) => ({
          bugId: 'bug-3',
          position: s.position,
          content: s.content,
        })),
      });
    });

    it('creates bug with MEDIUM severity and optional fields', async () => {
      const projectId = 'proj-1';
      const reporterId = 'user-2';
      const dto = {
        title: 'Dropdown misaligned',
        severity: 'MEDIUM' as any,
        environment: 'Chrome 120 on macOS',
      };
      const createdBug = {
        id: 'bug-4',
        projectId,
        reporterId,
        title: dto.title,
        severity: 'MEDIUM',
        environment: dto.environment,
        workflowStatusId: 'ws-open',
        workflowStatus: defaultWorkflowStatus,
        reporter: { id: 'user-2', username: 'dev', email: 'dev@test.com', name: 'Dev', imageUrl: null },
        assignee: null,
        reproSteps: [],
        parentTask: null,
      };

      mockTx.bug.create.mockResolvedValue(createdBug);
      mockTx.bug.findUniqueOrThrow.mockResolvedValue(createdBug);

      const result = await service.create(projectId, reporterId, dto);

      expect(result.severity).toBe('MEDIUM');
      expect(result.environment).toBe(dto.environment);
    });

    it('sets workflowStatusId to null when no default status exists', async () => {
      mockPrismaService.workflowStatus.findFirst.mockResolvedValue(null);

      const projectId = 'proj-1';
      const reporterId = 'user-1';
      const dto = { title: 'No default status', severity: 'LOW' as any };
      const createdBug = {
        id: 'bug-5',
        projectId,
        reporterId,
        title: dto.title,
        severity: 'LOW',
        workflowStatusId: null,
        workflowStatus: null,
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com', name: 'QC', imageUrl: null },
        assignee: null,
        reproSteps: [],
        parentTask: null,
      };

      mockTx.bug.create.mockResolvedValue(createdBug);
      mockTx.bug.findUniqueOrThrow.mockResolvedValue(createdBug);

      const result = await service.create(projectId, reporterId, dto);

      expect(result.workflowStatusId).toBeNull();
      expect(mockTx.bug.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workflowStatusId: null }),
        }),
      );
    });
  });

  describe('findAll()', () => {
    it('returns all bugs for a project', async () => {
      const projectId = 'proj-1';
      const bugs = [
        { id: 'bug-1', projectId, title: 'Bug A', workflowStatusId: 'ws-open', reproSteps: [] },
        { id: 'bug-2', projectId, title: 'Bug B', workflowStatusId: 'ws-open', reproSteps: [] },
      ];
      mockPrismaService.bug.findMany.mockResolvedValue(bugs);

      const result = await service.findAll(projectId);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.bug.findMany).toHaveBeenCalledWith({
        where: { projectId },
        include: BUG_RELATIONS,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('applies filters when provided', async () => {
      const projectId = 'proj-1';
      mockPrismaService.bug.findMany.mockResolvedValue([]);

      await service.findAll(projectId, {
        severity: 'HIGH',
        workflowStatusId: 'ws-open',
        assigneeId: 'user-1',
      });

      expect(mockPrismaService.bug.findMany).toHaveBeenCalledWith({
        where: {
          projectId,
          severity: 'HIGH',
          workflowStatusId: 'ws-open',
          assigneeId: 'user-1',
        },
        include: BUG_RELATIONS,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('applies search filter on title', async () => {
      const projectId = 'proj-1';
      mockPrismaService.bug.findMany.mockResolvedValue([]);

      await service.findAll(projectId, { search: 'login' });

      expect(mockPrismaService.bug.findMany).toHaveBeenCalledWith({
        where: {
          projectId,
          title: { contains: 'login', mode: 'insensitive' },
        },
        include: BUG_RELATIONS,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne()', () => {
    it('returns a single bug with attachments', async () => {
      const bugId = 'bug-1';
      const bug = {
        id: bugId,
        title: 'A bug',
        workflowStatusId: 'ws-open',
        reproSteps: [],
        attachments: [],
      };
      mockPrismaService.bug.findUnique.mockResolvedValue(bug);

      const result = await service.findOne(bugId);

      expect(result).toEqual(bug);
      expect(mockPrismaService.bug.findUnique).toHaveBeenCalledWith({
        where: { id: bugId },
        include: expect.objectContaining({
          ...BUG_RELATIONS,
          attachments: expect.any(Object),
        }),
      });
    });
  });

  describe('update()', () => {
    it('updates bug workflowStatusId', async () => {
      const bugId = 'bug-1';
      const dto = { workflowStatusId: 'ws-in-fix' };
      const updatedBug = {
        id: bugId,
        workflowStatusId: 'ws-in-fix',
        workflowStatus: { id: 'ws-in-fix', name: 'In Fix', kind: 'BUG', isDefault: false },
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com', name: 'QC', imageUrl: null },
        assignee: null,
        reproSteps: [],
        parentTask: null,
      };

      mockTx.bug.update.mockResolvedValue(updatedBug);
      mockTx.bug.findUniqueOrThrow.mockResolvedValue(updatedBug);

      const result = await service.update(bugId, dto);

      expect(result.workflowStatusId).toBe('ws-in-fix');
      expect(mockTx.bug.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: bugId },
          data: expect.objectContaining({ workflowStatusId: 'ws-in-fix' }),
        }),
      );
    });

    it('updates bug with repro steps (delete + recreate)', async () => {
      const bugId = 'bug-1';
      const dto = {
        reproSteps: [
          { position: 0, content: 'Step one' },
          { position: 1, content: 'Step two' },
        ],
      };
      const updatedBug = {
        id: bugId,
        workflowStatusId: 'ws-open',
        workflowStatus: defaultWorkflowStatus,
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com', name: 'QC', imageUrl: null },
        assignee: null,
        reproSteps: dto.reproSteps.map((s, i) => ({ id: `step-${i}`, bugId, ...s })),
        parentTask: null,
      };

      mockTx.bug.update.mockResolvedValue({ ...updatedBug, reproSteps: [] });
      mockTx.bugReproStep.deleteMany.mockResolvedValue({ count: 1 });
      mockTx.bugReproStep.createMany.mockResolvedValue({ count: 2 });
      mockTx.bug.findUniqueOrThrow.mockResolvedValue(updatedBug);

      const result = await service.update(bugId, dto);

      expect(result.reproSteps).toHaveLength(2);
      expect(mockTx.bugReproStep.deleteMany).toHaveBeenCalledWith({ where: { bugId } });
      expect(mockTx.bugReproStep.createMany).toHaveBeenCalledWith({
        data: dto.reproSteps.map((s) => ({
          bugId,
          position: s.position,
          content: s.content,
        })),
      });
    });

    it('clears repro steps when empty array is provided', async () => {
      const bugId = 'bug-1';
      const dto = { reproSteps: [] as any[] };
      const updatedBug = {
        id: bugId,
        workflowStatusId: 'ws-open',
        workflowStatus: defaultWorkflowStatus,
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com', name: 'QC', imageUrl: null },
        assignee: null,
        reproSteps: [],
        parentTask: null,
      };

      mockTx.bug.update.mockResolvedValue(updatedBug);
      mockTx.bugReproStep.deleteMany.mockResolvedValue({ count: 2 });
      mockTx.bug.findUniqueOrThrow.mockResolvedValue(updatedBug);

      const result = await service.update(bugId, dto);

      expect(result.reproSteps).toHaveLength(0);
      expect(mockTx.bugReproStep.deleteMany).toHaveBeenCalledWith({ where: { bugId } });
      expect(mockTx.bugReproStep.createMany).not.toHaveBeenCalled();
    });

    it('updates title without touching repro steps', async () => {
      const bugId = 'bug-1';
      const dto = { title: 'Updated title' };
      const updatedBug = {
        id: bugId,
        title: 'Updated title',
        workflowStatusId: 'ws-open',
        workflowStatus: defaultWorkflowStatus,
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com', name: 'QC', imageUrl: null },
        assignee: null,
        reproSteps: [{ id: 'step-0', bugId, position: 0, content: 'Existing step' }],
        parentTask: null,
      };

      mockTx.bug.update.mockResolvedValue(updatedBug);
      mockTx.bug.findUniqueOrThrow.mockResolvedValue(updatedBug);

      const result = await service.update(bugId, dto);

      expect(result.title).toBe('Updated title');
      expect(mockTx.bugReproStep.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.bugReproStep.createMany).not.toHaveBeenCalled();
    });
  });

  describe('delete()', () => {
    it('deletes a bug by id', async () => {
      const bugId = 'bug-1';
      mockPrismaService.bug.delete.mockResolvedValue({ id: bugId });

      const result = await service.delete(bugId);

      expect(result.id).toBe(bugId);
      expect(mockPrismaService.bug.delete).toHaveBeenCalledWith({ where: { id: bugId } });
    });
  });
});
