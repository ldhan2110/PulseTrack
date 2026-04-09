import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { hasPermission, type RolePermissions } from '../auth/permissions';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'bugs');

@Injectable()
export class BugAttachmentsService {
  constructor(private prisma: PrismaService) {}

  async create(bugId: string, uploaderId: string, file: Express.Multer.File, isInline = false) {
    const createAttachment = this.prisma.bugAttachment.create({
      data: {
        bugId,
        uploaderId,
        filename: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
      },
      include: {
        uploader: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
    });

    // Only log to bug history for explicit (non-inline) attachments
    if (isInline) {
      return createAttachment;
    }

    const [attachment] = await this.prisma.$transaction([
      createAttachment,
      this.prisma.bugHistory.create({
        data: {
          bugId,
          actorId: uploaderId,
          field: 'attachment_added',
          newValue: file.originalname,
        },
      }),
    ]);
    return attachment;
  }

  async findAll(bugId: string) {
    return this.prisma.bugAttachment.findMany({
      where: { bugId },
      include: {
        uploader: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(attachmentId: string, userId: string, permissions: RolePermissions) {
    const attachment = await this.prisma.bugAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.uploaderId !== userId && !hasPermission(permissions, 'attachments', 'delete')) {
      throw new ForbiddenException('Only the uploader or a PM can delete this attachment');
    }

    const filePath = path.join(UPLOAD_DIR, attachment.bugId, attachment.storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const [deleted] = await this.prisma.$transaction([
      this.prisma.bugAttachment.delete({ where: { id: attachmentId } }),
      this.prisma.bugHistory.create({
        data: {
          bugId: attachment.bugId,
          actorId: userId,
          field: 'attachment_deleted',
          oldValue: attachment.filename,
        },
      }),
    ]);
    return deleted;
  }

  async getFilePath(attachmentId: string): Promise<{ filePath: string; filename: string; mimeType: string }> {
    const attachment = await this.prisma.bugAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const filePath = path.join(UPLOAD_DIR, attachment.bugId, attachment.storedName);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found on disk');

    return { filePath, filename: attachment.filename, mimeType: attachment.mimeType };
  }
}
