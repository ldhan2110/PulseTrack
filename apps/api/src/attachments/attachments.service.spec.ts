import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachmentsService } from './attachments.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SYSTEM_ROLE_PERMISSIONS, DEFAULT_MEMBER_PERMISSIONS } from '../auth/permissions';

vi.mock('fs', () => ({
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

const mockAttachment = {
  id: 'attachment-1',
  filename: 'document.pdf',
  storedName: 'uuid-1234.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  taskId: 'task-1',
  uploaderId: 'user-1',
  isInline: false,
  createdAt: new Date(),
};

const mockFile: Express.Multer.File = {
  originalname: 'document.pdf',
  filename: 'uuid-1234.pdf',
  mimetype: 'application/pdf',
  size: 1024,
  fieldname: 'file',
  encoding: '7bit',
  destination: '/uploads/tasks/task-1',
  path: '/uploads/tasks/task-1/uuid-1234.pdf',
  buffer: Buffer.alloc(0),
  stream: null as any,
};

const mockPrisma = {
  attachment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  taskHistory: {
    create: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
};

describe('AttachmentsService', () => {
  let service: AttachmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    service = new AttachmentsService(mockPrisma as any);
  });

  describe('findAll()', () => {
    it('should only return non-inline attachments', async () => {
      mockPrisma.attachment.findMany.mockResolvedValue([mockAttachment]);

      await service.findAll('task-1');

      expect(mockPrisma.attachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { taskId: 'task-1', isInline: false },
        }),
      );
    });
  });

  describe('create()', () => {
    it('should create an explicit (non-inline) attachment by default', async () => {
      const created = { ...mockAttachment, uploader: { id: 'user-1', username: 'alice', email: 'alice@test.com' } };
      mockPrisma.attachment.create.mockResolvedValue(created);
      mockPrisma.taskHistory.create.mockResolvedValue({});

      const result = await service.create('task-1', 'user-1', mockFile);

      expect(mockPrisma.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isInline: false }),
        }),
      );
      expect(result.filename).toBe('document.pdf');
    });

    it('should create an inline attachment when isInline=true', async () => {
      const created = { ...mockAttachment, isInline: true, uploader: { id: 'user-1', username: 'alice', email: 'alice@test.com' } };
      mockPrisma.attachment.create.mockResolvedValue(created);
      mockPrisma.taskHistory.create.mockResolvedValue({});

      await service.create('task-1', 'user-1', mockFile, true);

      expect(mockPrisma.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isInline: true }),
        }),
      );
    });
  });

  describe('delete()', () => {
    it('should allow uploader to delete own attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(mockAttachment);
      mockPrisma.attachment.delete.mockResolvedValue(mockAttachment);
      mockPrisma.taskHistory.create.mockResolvedValue({});

      await expect(service.delete('attachment-1', 'user-1', DEFAULT_MEMBER_PERMISSIONS)).resolves.toBeDefined();
      expect(mockPrisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'attachment-1' } });
    });

    it('should allow PM to delete any attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(mockAttachment);
      mockPrisma.attachment.delete.mockResolvedValue(mockAttachment);
      mockPrisma.taskHistory.create.mockResolvedValue({});

      await expect(service.delete('attachment-1', 'other-user', SYSTEM_ROLE_PERMISSIONS)).resolves.toBeDefined();
    });

    it('should reject delete from non-uploader non-PM', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(mockAttachment);

      await expect(service.delete('attachment-1', 'other-user', DEFAULT_MEMBER_PERMISSIONS)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when attachment does not exist', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-1', SYSTEM_ROLE_PERMISSIONS)).rejects.toThrow(NotFoundException);
    });
  });
});
