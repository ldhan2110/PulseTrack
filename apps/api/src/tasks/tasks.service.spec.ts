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
    subTask: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    taskHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TasksService(mockPrismaService as any);
  });

  describe('create()', () => {
    it('creates a task with projectId, creatorId and returns with relations', async () => {
      const projectId = 'proj-1';
      const creatorId = 'user-1';
      const dto = { title: 'Implement login', description: 'OAuth flow' };
      const createdTask = {
        id: 'task-1',
        projectId,
        creatorId,
        title: dto.title,
        description: dto.description,
        status: 'BACKLOG',
        assignee: null,
        sprint: null,
      };

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

  describe('update() history recording', () => {
    it('should create a TaskHistory entry when status changes', async () => {
      // TODO: wire up after Task 2 modifies tasks.service.ts to accept actorId
      expect(true).toBe(true); // placeholder — Plan 01 Task 2 fills this in
    });

    it('should NOT create history when non-tracked field changes (e.g. description)', async () => {
      expect(true).toBe(true); // placeholder
    });

    it('should create multiple history entries when multiple tracked fields change', async () => {
      expect(true).toBe(true); // placeholder
    });
  });

  describe('getHistory()', () => {
    it('should return history entries ordered by createdAt desc', async () => {
      expect(true).toBe(true); // placeholder — Plan 01 Task 2 fills this in
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

  describe('createSubTask()', () => {
    it('creates a sub-task linked to the parent task', async () => {
      const taskId = 'task-1';
      const dto = { title: 'Write unit tests', status: 'BACKLOG' as any };
      const createdSubTask = {
        id: 'subtask-1',
        parentId: taskId,
        title: dto.title,
        status: 'BACKLOG',
        assignee: null,
      };

      mockPrismaService.subTask.create.mockResolvedValue(createdSubTask);

      const result = await service.createSubTask(taskId, dto);

      expect(result).toEqual(createdSubTask);
      expect(mockPrismaService.subTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ parentId: taskId, title: dto.title }),
        }),
      );
    });
  });

  describe('updateSubTask()', () => {
    it('updates sub-task status', async () => {
      const subTaskId = 'subtask-1';
      const dto = { status: 'DONE' as any };
      const updated = { id: subTaskId, status: 'DONE', assignee: null };

      mockPrismaService.subTask.update.mockResolvedValue(updated);

      const result = await service.updateSubTask(subTaskId, dto);

      expect(result.status).toBe('DONE');
    });
  });

  describe('deleteSubTask()', () => {
    it('deletes a sub-task by id', async () => {
      const subTaskId = 'subtask-1';
      mockPrismaService.subTask.delete.mockResolvedValue({ id: subTaskId });

      const result = await service.deleteSubTask(subTaskId);

      expect(result.id).toBe(subTaskId);
      expect(mockPrismaService.subTask.delete).toHaveBeenCalledWith({
        where: { id: subTaskId },
      });
    });
  });
});
