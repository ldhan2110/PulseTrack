import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentsService } from './comments.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

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
};

describe('CommentsService', () => {
  let service: CommentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CommentsService(mockPrisma as any);
  });

  describe('create()', () => {
    it('should create a top-level comment', async () => {
      const created = { ...mockComment, author: { id: 'user-1', username: 'alice', email: 'alice@test.com' }, replies: [] };
      mockPrisma.comment.create.mockResolvedValue(created);

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

      await expect(service.delete('comment-1', 'user-1', 'developer')).resolves.toBeDefined();
      expect(mockPrisma.comment.deleteMany).toHaveBeenCalledWith({ where: { parentId: 'comment-1' } });
      expect(mockPrisma.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment-1' } });
    });

    it('should allow PM to delete any comment', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(mockComment);
      mockPrisma.comment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.comment.delete.mockResolvedValue(mockComment);

      await expect(service.delete('comment-1', 'other-user', 'pm')).resolves.toBeDefined();
    });

    it('should reject delete from non-author non-PM', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(mockComment);

      await expect(service.delete('comment-1', 'other-user', 'developer')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-1', 'pm')).rejects.toThrow(NotFoundException);
    });
  });
});
