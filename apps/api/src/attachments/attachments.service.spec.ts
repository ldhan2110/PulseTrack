import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachmentsService } from './attachments.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

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
};

describe('AttachmentsService', () => {
  let service: AttachmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AttachmentsService(mockPrisma as any);
  });

  describe('create()', () => {
    it('should create an attachment record', async () => {
      const created = { ...mockAttachment, uploader: { id: 'user-1', username: 'alice', email: 'alice@test.com' } };
      mockPrisma.attachment.create.mockResolvedValue(created);

      const result = await service.create('task-1', 'user-1', mockFile);

      expect(mockPrisma.attachment.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task-1',
          uploaderId: 'user-1',
          filename: 'document.pdf',
          storedName: 'uuid-1234.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        },
        include: expect.any(Object),
      });
      expect(result.filename).toBe('document.pdf');
    });
  });

  describe('delete()', () => {
    it('should allow uploader to delete own attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(mockAttachment);
      mockPrisma.attachment.delete.mockResolvedValue(mockAttachment);

      await expect(service.delete('attachment-1', 'user-1', 'developer')).resolves.toBeDefined();
      expect(mockPrisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'attachment-1' } });
    });

    it('should allow PM to delete any attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(mockAttachment);
      mockPrisma.attachment.delete.mockResolvedValue(mockAttachment);

      await expect(service.delete('attachment-1', 'other-user', 'pm')).resolves.toBeDefined();
    });

    it('should reject delete from non-uploader non-PM', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(mockAttachment);

      await expect(service.delete('attachment-1', 'other-user', 'developer')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when attachment does not exist', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-1', 'pm')).rejects.toThrow(NotFoundException);
    });
  });
});
