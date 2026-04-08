import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WatchersService } from '../watchers/watchers.service';
import { extractMentionedUserIds } from '../notifications/mention-extractor';
import type { EntityType } from '@prisma/client';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private watchersService: WatchersService,
  ) {}

  async findAll(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId, parentId: null },
      include: {
        author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        replies: {
          include: {
            author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(taskId: string, authorId: string, content: string) {
    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { taskId, authorId, content },
        include: {
          author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          replies: true,
        },
      }),
      this.prisma.taskHistory.create({
        data: {
          taskId,
          actorId: authorId,
          field: 'comment_added',
          newValue: content.replace(/<[^>]*>/g, '').slice(0, 200),
        },
      }),
    ]);
    void this.triggerCommentNotifications({ taskId }, authorId, content, 'COMMENT_ADDED');
    return comment;
  }

  async createReply(taskId: string, parentId: string, authorId: string, content: string) {
    const parent = await this.prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.taskId !== taskId) {
      throw new NotFoundException('Parent comment not found');
    }
    const [reply] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { taskId, authorId, content, parentId },
        include: {
          author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        },
      }),
      this.prisma.taskHistory.create({
        data: {
          taskId,
          actorId: authorId,
          field: 'comment_added',
          newValue: content.replace(/<[^>]*>/g, '').slice(0, 200),
        },
      }),
    ]);
    return reply;
  }

  async delete(commentId: string, userId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId && userRole !== 'pm') {
      throw new ForbiddenException('Only the comment author or a PM can delete this comment');
    }
    const txOps: any[] = [
      this.prisma.comment.deleteMany({ where: { parentId: commentId } }),
      this.prisma.comment.delete({ where: { id: commentId } }),
    ];
    if (comment.taskId) {
      txOps.push(
        this.prisma.taskHistory.create({
          data: {
            taskId: comment.taskId,
            actorId: userId,
            field: 'comment_deleted',
            oldValue: comment.content.replace(/<[^>]*>/g, '').slice(0, 200),
          },
        }),
      );
    }
    await this.prisma.$transaction(txOps);
  }

  // ── Bug comment methods ─────────────────────────────────────────────────

  async findAllForBug(bugId: string) {
    return this.prisma.comment.findMany({
      where: { bugId, parentId: null },
      include: {
        author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        replies: {
          include: {
            author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createForBug(bugId: string, authorId: string, content: string) {
    const comment = await this.prisma.comment.create({
      data: { bugId, authorId, content },
      include: {
        author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        replies: true,
      },
    });
    void this.triggerCommentNotifications({ bugId }, authorId, content, 'COMMENT_ADDED');
    return comment;
  }

  async createReplyForBug(bugId: string, parentId: string, authorId: string, content: string) {
    const parent = await this.prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.bugId !== bugId) {
      throw new NotFoundException('Parent comment not found');
    }
    return this.prisma.comment.create({
      data: { bugId, authorId, content, parentId },
      include: {
        author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
    });
  }

  async update(commentId: string, userId: string, userRole: string, content: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId && userRole !== 'pm') {
      throw new ForbiddenException('Only the comment author or a PM can edit this comment');
    }

    const oldContent = comment.content;

    const txOps: any[] = [
      this.prisma.comment.update({
        where: { id: commentId },
        data: { content, isEdited: true },
        include: {
          author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        },
      }),
    ];
    if (comment.taskId) {
      txOps.push(
        this.prisma.taskHistory.create({
          data: {
            taskId: comment.taskId,
            actorId: userId,
            field: 'comment_edited',
            oldValue: oldContent.replace(/<[^>]*>/g, '').slice(0, 500),
            newValue: content.replace(/<[^>]*>/g, '').slice(0, 500),
          },
        }),
      );
    }
    const [updated] = await this.prisma.$transaction(txOps);
    return updated;
  }

  private async triggerCommentNotifications(
    opts: { taskId?: string; bugId?: string },
    authorId: string,
    content: string,
    type: 'COMMENT_ADDED' | 'COMMENT_EDITED' | 'COMMENT_DELETED',
  ) {
    const entityType: EntityType = opts.taskId ? 'TASK' : 'BUG';
    const entityId = (opts.taskId ?? opts.bugId)!;

    // Get entity title and projectId
    let entityTitle = '';
    let projectId = '';
    if (opts.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: opts.taskId },
        select: { taskKey: true, title: true, projectId: true },
      });
      entityTitle = task?.taskKey ? `${task.taskKey}: ${task.title}` : task?.title ?? '';
      projectId = task?.projectId ?? '';
    } else if (opts.bugId) {
      const bug = await this.prisma.bug.findUnique({
        where: { id: opts.bugId },
        select: { title: true, projectId: true },
      });
      entityTitle = bug?.title ?? '';
      projectId = bug?.projectId ?? '';
    }
    if (!projectId) return;

    const preview = content.replace(/<[^>]*>/g, '').slice(0, 100);
    const summaryMap = {
      COMMENT_ADDED: `commented: "${preview}"`,
      COMMENT_EDITED: 'edited a comment',
      COMMENT_DELETED: 'deleted a comment',
    };

    // Notify watchers
    const watcherIds = await this.watchersService.getWatcherUserIds(entityType, entityId);
    const watcherRecipients = watcherIds.filter((id) => id !== authorId);
    if (watcherRecipients.length > 0) {
      await this.notificationsService.createMany(
        watcherRecipients.map((recipientId) => ({
          recipientId,
          projectId,
          type: type as any,
          entityType,
          entityId,
          entityTitle,
          actorId: authorId,
          summary: summaryMap[type],
        })),
      );
    }

    // Notify mentioned users (only on create/edit)
    if (type !== 'COMMENT_DELETED') {
      const mentionedIds = extractMentionedUserIds(content).filter(
        (id) => id !== authorId && !watcherIds.includes(id),
      );
      if (mentionedIds.length > 0) {
        await this.notificationsService.createMany(
          mentionedIds.map((recipientId) => ({
            recipientId,
            projectId,
            type: 'MENTION' as any,
            entityType,
            entityId,
            entityTitle,
            actorId: authorId,
            summary: 'mentioned you in a comment',
          })),
        );
      }
    }
  }
}
