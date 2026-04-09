import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentsService } from './comments.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SYSTEM_ROLE_PERMISSIONS, DEFAULT_MEMBER_PERMISSIONS } from '../auth/permissions';

const mockComment = {
  id: 'comment-1',
  content: 'Hello world',
  taskId: 'task-1',
  authorId: 'user-1',
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  comment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    delete: vi.fn(),
  },
  taskHistory: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

describe('CommentsService', () => {
  let service: CommentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    // $transaction receives an array of promises and resolves them
    mockPrisma.$transaction.mockImplementation(async (args: any) => {
      if (Array.isArray(args)) {
        return Promise.all(args);
      }
      return args(mockPrisma);
    });
    const mockNotificationsService = { createMany: vi.fn() };
    const mockWatchersService = { getWatcherUserIds: vi.fn().mockResolvedValue([]) };
    service = new CommentsService(
      mockPrisma as any,
      mockNotificationsService as any,
      mockWatchersService as any,
    );
  });

  describe('create()', () => {
    it('should create a top-level comment', async () => {
      const created = { ...mockComment, author: { id: 'user-1', username: 'alice', email: 'alice@test.com' }, replies: [] };
      mockPrisma.comment.create.mockResolvedValue(created);
      mockPrisma.taskHistory.create.mockResolvedValue({});

      const result = await service.create('task-1', 'user-1', 'Hello world');

      expect(mockPrisma.comment.create).toHaveBeenCalledWith({
        data: { taskId: 'task-1', authorId: 'user-1', content: 'Hello world' },
        include: expect.any(Object),
      });
      expect(result.content).toBe('Hello world');
    });
  });

  describe('findAll()', () => {
    it('should return top-level comments with nested replies', async () => {
      const comments = [{ ...mockComment, author: { id: 'user-1', username: 'alice', email: 'alice@test.com' }, replies: [] }];
      mockPrisma.comment.findMany.mockResolvedValue(comments);

      const result = await service.findAll('task-1');

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { taskId: 'task-1', parentId: null } }),
      );
      expect(result).toEqual(comments);
    });
  });

  describe('delete()', () => {
    it('should allow author to delete own comment', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(mockComment);
      mockPrisma.comment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.comment.delete.mockResolvedValue(mockComment);
      mockPrisma.taskHistory.create.mockResolvedValue({});

      await expect(service.delete('comment-1', 'user-1', DEFAULT_MEMBER_PERMISSIONS)).resolves.toBeUndefined();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should allow PM to delete any comment', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(mockComment);
      mockPrisma.comment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.comment.delete.mockResolvedValue(mockComment);
      mockPrisma.taskHistory.create.mockResolvedValue({});

      await expect(service.delete('comment-1', 'other-user', SYSTEM_ROLE_PERMISSIONS)).resolves.toBeUndefined();
    });

    it('should reject delete from non-author non-PM', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(mockComment);

      await expect(service.delete('comment-1', 'other-user', DEFAULT_MEMBER_PERMISSIONS)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-1', SYSTEM_ROLE_PERMISSIONS)).rejects.toThrow(NotFoundException);
    });
  });
});
