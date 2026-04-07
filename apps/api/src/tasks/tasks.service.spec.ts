import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;

  const mockPrismaService = {
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    taskHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
    workflowStatus: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockNotificationsService = {
    notifyProject: vi.fn(),
    notifyUser: vi.fn(),
  };

  const mockWorkflowService = {
    getValidTransitions: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TasksService(
      mockPrismaService as any,
      mockNotificationsService as any,
      mockWorkflowService as any,
    );
  });

  describe('create()', () => {
    it('creates a top-level task with projectId, creatorId and returns with relations', async () => {
      const projectId = 'proj-1';
      const creatorId = 'user-1';
      const dto = { title: 'Implement login', description: 'OAuth flow' };
      const createdTask = {
        id: 'task-1',
        projectId,
        creatorId,
        title: dto.title,
        taskKey: 'PM-1',
        description: dto.description,
        workflowStatus: { id: 'ws-1', name: 'Backlog' },
        assignee: null,
        sprint: null,
      };

      mockPrismaService.$transaction.mockImplementation(async (fn: any) => fn(mockPrismaService));
      mockPrismaService.project.update.mockResolvedValue({ prefix: 'PM', taskSeq: 1 });
      mockPrismaService.workflowStatus.findFirst.mockResolvedValue({ id: 'ws-1' });
      mockPrismaService.task.create.mockResolvedValue(createdTask);

      const result = await service.create(projectId, creatorId, dto);

      expect(result).toEqual(createdTask);
      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ projectId, creatorId, title: dto.title }),
        }),
      );
    });
  });

  describe('update()', () => {
    const actorId = 'user-1';

    beforeEach(() => {
      // Mock findUniqueOrThrow for history diff
      mockPrismaService.task.findUniqueOrThrow.mockResolvedValue({
        id: 'task-1',
        workflowStatusId: 'ws-backlog',
        workflowStatus: { id: 'ws-backlog', name: 'Backlog' },
        assigneeId: null,
        sprintId: null,
        storyPoints: null,
        title: 'Old title',
        projectId: 'proj-1',
      });
    });

    it('updates task workflowStatusId', async () => {
      const taskId = 'task-1';
      const dto = { workflowStatusId: 'ws-inprogress' };
      const updatedTask = { id: taskId, workflowStatusId: 'ws-inprogress', workflowStatus: { id: 'ws-inprogress', name: 'In Progress' }, assignee: null, sprint: null };

      mockWorkflowService.getValidTransitions.mockResolvedValue([
        { id: 'ws-inprogress', name: 'In Progress' },
      ]);
      mockPrismaService.workflowStatus.findUnique.mockResolvedValue({ name: 'In Progress' });
      mockPrismaService.$transaction.mockResolvedValue([updatedTask]);

      const result = await service.update(taskId, dto, actorId);

      expect(result.workflowStatusId).toBe('ws-inprogress');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('sets assigneeId on a task', async () => {
      const taskId = 'task-1';
      const dto = { assigneeId: 'user-2' };
      const updatedTask = { id: taskId, assigneeId: 'user-2', assignee: { id: 'user-2', username: 'dev', email: 'dev@test.com' }, sprint: null };

      mockPrismaService.$transaction.mockResolvedValue([updatedTask]);

      const result = await service.update(taskId, dto, actorId);

      expect(result.assigneeId).toBe('user-2');
    });

    it('clears assigneeId by setting it to null', async () => {
      const taskId = 'task-1';
      const dto = { assigneeId: null as any };
      const updatedTask = { id: taskId, assigneeId: null, assignee: null, sprint: null };

      mockPrismaService.$transaction.mockResolvedValue([updatedTask]);

      const result = await service.update(taskId, dto, actorId);

      expect(result.assigneeId).toBeNull();
    });

    it('updates storyPoints and acceptanceCriteria', async () => {
      const taskId = 'task-1';
      const dto = { storyPoints: 5, acceptanceCriteria: 'Given X when Y then Z' };
      const updatedTask = { id: taskId, storyPoints: 5, acceptanceCriteria: 'Given X when Y then Z', assignee: null, sprint: null };

      mockPrismaService.$transaction.mockResolvedValue([updatedTask]);

      const result = await service.update(taskId, dto, actorId);

      expect(result.storyPoints).toBe(5);
      expect(result.acceptanceCriteria).toBe('Given X when Y then Z');
    });
  });

  describe('delete()', () => {
    it('deletes a task by id', async () => {
      const taskId = 'task-1';
      mockPrismaService.task.delete.mockResolvedValue({ id: taskId });

      const result = await service.delete(taskId);

      expect(result.id).toBe(taskId);
      expect(mockPrismaService.task.delete).toHaveBeenCalledWith({
        where: { id: taskId },
      });
    });
  });

  describe('create() - sub-task hierarchy', () => {
    it('rejects creating a sub-task on a sub-task (max 1 level)', async () => {
      mockPrismaService.$transaction.mockImplementation(async (fn: any) => fn(mockPrismaService));
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'parent-id',
        projectId: 'proj-1',
        parentId: 'grandparent-id',
        taskKey: 'PM-1-1',
      });

      await expect(
        service.create('proj-1', 'user-1', {
          title: 'Nested sub-task',
          parentId: 'parent-id',
        }),
      ).rejects.toThrow('Cannot create sub-tasks on a sub-task');
    });
  });
});
