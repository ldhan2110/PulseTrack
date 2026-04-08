import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'bugs');

@Injectable()
export class BugAttachmentsService {
  constructor(private prisma: PrismaService) {}

  async create(bugId: string, uploaderId: string, file: Express.Multer.File) {
    return this.prisma.bugAttachment.create({
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

  async delete(attachmentId: string, userId: string, userRole: string) {
    const attachment = await this.prisma.bugAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.uploaderId !== userId && userRole !== 'pm') {
      throw new ForbiddenException('Only the uploader or a PM can delete this attachment');
    }

    const filePath = path.join(UPLOAD_DIR, attachment.bugId, attachment.storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return this.prisma.bugAttachment.delete({ where: { id: attachmentId } });
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
