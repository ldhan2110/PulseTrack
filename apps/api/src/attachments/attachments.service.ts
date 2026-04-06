import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AttachmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(taskId: string) {
    return this.prisma.attachment.findMany({
      where: { taskId },
      include: {
        uploader: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(taskId: string, uploaderId: string, file: Express.Multer.File) {
    const [attachment] = await this.prisma.$transaction([
      this.prisma.attachment.create({
        data: {
          taskId,
          uploaderId,
          filename: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
        },
        include: {
          uploader: { select: { id: true, username: true, email: true } },
        },
      }),
      this.prisma.taskHistory.create({
        data: {
          taskId,
          actorId: uploaderId,
          field: 'attachment_added',
          newValue: file.originalname,
        },
      }),
    ]);
    return attachment;
  }

  async findOne(attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  async delete(attachmentId: string, userId: string, userRole: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    // Only uploader or PM can delete (per D-19 — same pattern as comment deletion D-10)
    if (attachment.uploaderId !== userId && userRole !== 'pm') {
      throw new ForbiddenException('Only the uploader or a PM can delete this attachment');
    }
    // Delete file from disk
    try {
      const filePath = join(process.cwd(), 'uploads', 'tasks', attachment.taskId, attachment.storedName);
      unlinkSync(filePath);
    } catch {
      // File may already be missing — proceed with DB deletion
    }
    const [deleted] = await this.prisma.$transaction([
      this.prisma.attachment.delete({ where: { id: attachmentId } }),
      this.prisma.taskHistory.create({
        data: {
          taskId: attachment.taskId,
          actorId: userId,
          field: 'attachment_deleted',
          oldValue: attachment.filename,
        },
      }),
    ]);
    return deleted;
  }
}
