import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId, parentId: null },
      include: {
        author: { select: { id: true, username: true, email: true } },
        replies: {
          include: {
            author: { select: { id: true, username: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(taskId: string, authorId: string, content: string) {
    return this.prisma.comment.create({
      data: { taskId, authorId, content },
      include: {
        author: { select: { id: true, username: true, email: true } },
        replies: true,
      },
    });
  }

  async createReply(taskId: string, parentId: string, authorId: string, content: string) {
    // Verify parent comment exists and belongs to the same task
    const parent = await this.prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.taskId !== taskId) {
      throw new NotFoundException('Parent comment not found');
    }
    return this.prisma.comment.create({
      data: { taskId, authorId, content, parentId },
      include: {
        author: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async delete(commentId: string, userId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    // Only author or PM can delete (per D-10)
    if (comment.authorId !== userId && userRole !== 'pm') {
      throw new ForbiddenException('Only the comment author or a PM can delete this comment');
    }
    // Delete replies first (parentId FK is NoAction), then delete the comment
    await this.prisma.comment.deleteMany({ where: { parentId: commentId } });
    return this.prisma.comment.delete({ where: { id: commentId } });
  }
}
