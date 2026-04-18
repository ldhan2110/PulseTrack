import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WatchersService } from '../watchers/watchers.service';
import { extractMentionedUserIds } from '../notifications/mention-extractor';
import type { EntityType, Prisma } from '@prisma/client';
import { hasPermission, type RolePermissions } from '../auth/permissions';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private watchersService: WatchersService,
  ) {}

  private static readonly AUTHOR_SELECT = { id: true, username: true, email: true, name: true, imageUrl: true } as const;

  private static readonly LIKE_SELECT = {
    userId: true,
    user: { select: { id: true, username: true, name: true, imageUrl: true } },
  } as const;

  private buildCommentTree(comments: any[]): any[] {
    const map = new Map<string, any>();
    const roots: any[] = [];
    for (const c of comments) {
      map.set(c.id, { ...c, replies: [] });
    }
    for (const c of comments) {
      const node = map.get(c.id)!;
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.replies.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async findAll(taskId: string) {
    const comments = await this.prisma.comment.findMany({
      where: { taskId },
      include: {
        author: { select: CommentsService.AUTHOR_SELECT },
        likes: { select: CommentsService.LIKE_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });
    return this.buildCommentTree(comments);
  }

  async create(taskId: string, authorId: string, content: string) {
    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { taskId, authorId, content },
        include: {
          author: { select: CommentsService.AUTHOR_SELECT },
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
          author: { select: CommentsService.AUTHOR_SELECT },
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

  private async collectDescendantIds(commentId: string): Promise<string[]> {
    const children = await this.prisma.comment.findMany({
      where: { parentId: commentId },
      select: { id: true },
    });
    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id, ...(await this.collectDescendantIds(child.id)));
    }
    return ids;
  }

  async delete(commentId: string, userId: string, permissions: RolePermissions) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId && !hasPermission(permissions, 'comments', 'delete')) {
      throw new ForbiddenException('Only the comment author or a PM can delete this comment');
    }
    const descendantIds = await this.collectDescendantIds(commentId);
    const allIds = [commentId, ...descendantIds];
    const txOps: any[] = [
      this.prisma.comment.deleteMany({ where: { id: { in: allIds } } }),
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
    if (comment.bugId) {
      txOps.push(
        this.prisma.bugHistory.create({
          data: {
            bugId: comment.bugId,
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
    const comments = await this.prisma.comment.findMany({
      where: { bugId },
      include: {
        author: { select: CommentsService.AUTHOR_SELECT },
        likes: { select: CommentsService.LIKE_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });
    return this.buildCommentTree(comments);
  }

  async createForBug(bugId: string, authorId: string, content: string) {
    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { bugId, authorId, content },
        include: {
          author: { select: CommentsService.AUTHOR_SELECT },
        },
      }),
      this.prisma.bugHistory.create({
        data: {
          bugId,
          actorId: authorId,
          field: 'comment_added',
          newValue: content.replace(/<[^>]*>/g, '').slice(0, 200),
        },
      }),
    ]);
    void this.triggerCommentNotifications({ bugId }, authorId, content, 'COMMENT_ADDED');
    return comment;
  }

  async createReplyForBug(bugId: string, parentId: string, authorId: string, content: string) {
    const parent = await this.prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.bugId !== bugId) {
      throw new NotFoundException('Parent comment not found');
    }
    const [reply] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { bugId, authorId, content, parentId },
        include: {
          author: { select: CommentsService.AUTHOR_SELECT },
        },
      }),
      this.prisma.bugHistory.create({
        data: {
          bugId,
          actorId: authorId,
          field: 'comment_added',
          newValue: content.replace(/<[^>]*>/g, '').slice(0, 200),
        },
      }),
    ]);
    return reply;
  }

  async update(commentId: string, userId: string, permissions: RolePermissions, content: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId && !hasPermission(permissions, 'comments', 'update')) {
      throw new ForbiddenException('Only the comment author or a PM can edit this comment');
    }

    const oldContent = comment.content;

    const txOps: any[] = [
      this.prisma.comment.update({
        where: { id: commentId },
        data: { content, isEdited: true },
        include: {
          author: { select: CommentsService.AUTHOR_SELECT },
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
    if (comment.bugId) {
      txOps.push(
        this.prisma.bugHistory.create({
          data: {
            bugId: comment.bugId,
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

    // Get entity title, projectId, and entityKey for navigation
    let entityTitle = '';
    let projectId = '';
    let entityKey: string | null = null;
    if (opts.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: opts.taskId },
        select: { taskKey: true, title: true, projectId: true },
      });
      entityTitle = task?.taskKey ? `${task.taskKey}: ${task.title}` : task?.title ?? '';
      projectId = task?.projectId ?? '';
      entityKey = task?.taskKey ?? null;
    } else if (opts.bugId) {
      const bug = await this.prisma.bug.findUnique({
        where: { id: opts.bugId },
        select: { bugKey: true, title: true, projectId: true },
      });
      entityTitle = bug?.title ?? '';
      projectId = bug?.projectId ?? '';
      entityKey = bug?.bugKey ?? null;
    }
    if (!projectId) return;

    // Fetch project prefix for notification navigation metadata
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { prefix: true },
    });
    const notifMetadata: Prisma.InputJsonValue = {
      ...(project?.prefix && { projectPrefix: project.prefix }),
      ...(entityKey && { entityKey }),
    };

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
          metadata: notifMetadata,
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
            summary: `mentioned you in a comment: "${preview}"`,
            metadata: notifMetadata,
          })),
        );
      }
    }
  }

  async toggleLike(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const existing = await this.prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });

    if (existing) {
      await this.prisma.commentLike.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.commentLike.create({ data: { commentId, userId } });
    }

    const likes = await this.prisma.commentLike.findMany({
      where: { commentId },
      select: CommentsService.LIKE_SELECT,
    });

    return {
      likes,
      liked: !existing,
      count: likes.length,
    };
  }
}
