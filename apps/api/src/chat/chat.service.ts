import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType } from '@prisma/client';
import type { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

const memberUserSelect = {
  select: { id: true, username: true, email: true, name: true, imageUrl: true },
};

// Shallow parent preview for a reply — no nested replyTo, no reactions/attachments.
const replyToInclude = {
  select: { id: true, body: true, deletedAt: true, author: memberUserSelect },
};

/** Blank a soft-deleted parent's body so a reply shows "message deleted", never stale text. */
function stripDeletedReply<T extends { replyTo?: { deletedAt: Date | null; body: string } | null }>(
  m: T,
): T {
  return m.replyTo?.deletedAt ? { ...m, replyTo: { ...m.replyTo, body: '' } } : m;
}

const HISTORY_PAGE = 30;

@Injectable()
export class ChatService {
  private server?: Server;

  constructor(private readonly prisma: PrismaService) {}

  /** Called by ChatGateway.afterInit so the service can broadcast to rooms. */
  setServer(server: Server): void {
    this.server = server;
  }

  emitToConvo(conversationId: string, event: string, payload: unknown): void {
    this.server?.to(`convo:${conversationId}`).emit(event, payload);
  }

  /** Emit to a user's personal room (joined on connect), reaching them even
   *  when they don't have the conversation open. Mirrors emitToConvo. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  /** Throws ForbiddenException unless the user is a member of the conversation. */
  async assertMember(conversationId: string, userId: string): Promise<void> {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this conversation');
    }
  }

  /**
   * DM: soft-closes the caller's membership (hidden + message floor set) so reopening
   * the same pair reuses this record instead of creating a duplicate. Channel: hard delete.
   * Peers + messages always intact.
   */
  async leaveConversation(conversationId: string, userId: string) {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true },
    });
    if (convo?.type === ConversationType.DM) {
      const now = new Date();
      await this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { deletedAt: now, clearedAt: now },
      });
    } else {
      await this.prisma.conversationMember.delete({
        where: { conversationId_userId: { conversationId, userId } },
      });
    }
    const updated = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { members: { include: { user: memberUserSelect } } },
    });
    this.emitToConvo(conversationId, 'chat:members:changed', updated?.members);
    this.emitToUser(userId, 'chat:conversation:removed', { conversationId });
    return { deleted: true };
  }

  /** Any channel member may add users (role 'member'); duplicates silently skipped. */
  async addMembers(conversationId: string, actorId: string, userIds: string[]) {
    await this.assertMember(conversationId, actorId);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true },
    });
    if (conversation?.type !== ConversationType.CHANNEL) {
      throw new BadRequestException('Members can only be added to a channel');
    }
    const ids = [...new Set(userIds)];
    await this.prisma.conversationMember.createMany({
      data: ids.map((userId) => ({
        conversationId,
        userId,
        role: 'member',
        createdBy: actorId,
      })),
      skipDuplicates: true,
    });
    const updated = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { members: { include: { user: memberUserSelect } } },
    });
    this.emitToConvo(conversationId, 'chat:members:changed', updated?.members);
    // ponytail: emit to every requested id; a duplicate already has the channel,
    // so a redundant invalidate is harmless — no need to diff the createMany count.
    for (const userId of ids) {
      this.emitToUser(userId, 'chat:conversation:added', updated);
    }
    return updated;
  }

  /** Owner-only removal of another member from a channel. */
  async removeMember(conversationId: string, actorId: string, targetId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true },
    });
    if (conversation?.type !== ConversationType.CHANNEL) {
      throw new BadRequestException('Members can only be removed from a channel');
    }
    const actor = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: actorId } },
      select: { role: true },
    });
    if (actor?.role !== 'owner') {
      throw new ForbiddenException('Only the channel owner can remove members');
    }
    await this.prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId: targetId } },
    });
    const updated = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { members: { include: { user: memberUserSelect } } },
    });
    this.emitToConvo(conversationId, 'chat:members:changed', updated?.members);
    this.emitToUser(targetId, 'chat:conversation:removed', { conversationId });
    return { removed: true };
  }

  async createConversation(userId: string, dto: CreateConversationDto) {
    if (dto.type === ConversationType.DM) {
      const otherId = dto.memberIds[0];
      const existing = await this.prisma.conversation.findFirst({
        where: {
          type: ConversationType.DM,
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: otherId } } },
          ],
        },
        include: { members: { include: { user: memberUserSelect } } },
      });
      if (existing) {
        // Reopen: un-hide caller and set floor to now so old messages stay cut off.
        const mine = existing.members?.find((m) => m.userId === userId);
        if (mine?.deletedAt) {
          await this.prisma.conversationMember.update({
            where: { conversationId_userId: { conversationId: existing.id, userId } },
            data: { deletedAt: null, clearedAt: new Date() },
          });
        }
        return existing;
      }

      return this.prisma.conversation.create({
        data: {
          type: ConversationType.DM,
          createdBy: userId,
          members: {
            create: [
              { userId, createdBy: userId },
              { userId: otherId, createdBy: userId },
            ],
          },
        },
        include: { members: { include: { user: memberUserSelect } } },
      });
    }

    // CHANNEL: creator is owner, listed members join as "member" (creator deduped out)
    const memberIds = [...new Set(dto.memberIds)].filter((id) => id !== userId);
    return this.prisma.conversation.create({
      data: {
        type: ConversationType.CHANNEL,
        name: dto.name,
        creatorId: userId,
        createdBy: userId,
        members: {
          create: [
            { userId, role: 'owner', createdBy: userId },
            ...memberIds.map((id) => ({
              userId: id,
              role: 'member',
              createdBy: userId,
            })),
          ],
        },
      },
      include: { members: { include: { user: memberUserSelect } } },
    });
  }

  async searchTargets(userId: string, query: string) {
    return this.prisma.user.findMany({
      where: {
        id: { not: userId },
        // Directory scoping: only users who share an invited project with the
        // caller — never past DM partners or the whole user table
        // (external→internal enumeration).
        projectMembers: { some: { project: { members: { some: { userId } } } } },
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      ...memberUserSelect,
      take: 20,
    });
  }

  async listMyConversations(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId, deletedAt: null },
      include: {
        conversation: {
          include: {
            members: { include: { user: memberUserSelect } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    // ponytail: per-conversation unread count (N+1). Batch with groupBy if the list grows.
    return Promise.all(
      memberships.map(async (m) => {
        // Floor = later of read cursor and DM-close floor; messages before it are hidden.
        const floor = [m.lastReadAt, m.clearedAt]
          .filter((d): d is Date => !!d)
          .sort((a, b) => +b - +a)[0];
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: m.conversationId,
            authorId: { not: userId },
            deletedAt: null,
            ...(floor ? { createdAt: { gt: floor } } : {}),
          },
        });
        const last = m.conversation.messages[0];
        const lastVisible = last && (!m.clearedAt || last.createdAt > m.clearedAt);
        return {
          ...m.conversation,
          messages: undefined,
          lastMessage: lastVisible
            ? { ...last, body: last.deletedAt ? '' : last.body }
            : null,
          unreadCount,
        };
      }),
    );
  }

  async sendMessage(
    conversationId: string,
    authorId: string,
    body: string | undefined,
    replyToId?: string,
    clientTempId?: string,
  ) {
    if (!body || !body.trim()) {
      throw new BadRequestException('Message body is required');
    }
    if (replyToId) {
      const parent = await this.prisma.message.findUnique({
        where: { id: replyToId },
        select: { conversationId: true },
      });
      if (!parent || parent.conversationId !== conversationId) {
        throw new BadRequestException('Reply target is not in this conversation');
      }
    }
    const created = await this.prisma.message.create({
      data: { conversationId, authorId, body, replyToId, createdBy: authorId },
      include: {
        author: memberUserSelect,
        reactions: { include: { user: memberUserSelect } },
        replyTo: replyToInclude,
      },
    });
    // Transient echo (not persisted) so the sender can match its optimistic message.
    const message = { ...stripDeletedReply(created), clientTempId };
    this.emitToConvo(conversationId, 'chat:message:new', message);
    await this.notifyMentions(conversationId, created.id, created.author, body);
    return message;
  }

  /** Parse @[Name](userId) tokens; notify mentioned members (not the author). No persistence. */
  private async notifyMentions(
    conversationId: string,
    messageId: string,
    author: { id: string; name: string | null },
    body: string,
  ): Promise<void> {
    const ids = [...body.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => m[2]);
    const unique = [...new Set(ids)].filter((id) => id !== author.id);
    if (unique.length === 0) return;
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId, userId: { in: unique } },
      select: { userId: true },
    });
    const preview = body.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1').slice(0, 140);
    for (const { userId } of members) {
      this.emitToUser(userId, 'chat:mention', {
        conversationId,
        messageId,
        from: { id: author.id, name: author.name },
        preview,
      });
    }
  }

  async getMessages(conversationId: string, userId: string, cursor?: string) {
    const me = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { clearedAt: true },
    });
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(me?.clearedAt ? { createdAt: { gt: me.clearedAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: memberUserSelect,
        attachments: true,
        reactions: { include: { user: memberUserSelect } },
        replyTo: replyToInclude,
      },
    });
    const items = rows.map((m) =>
      stripDeletedReply(m.deletedAt ? { ...m, body: '' } : m),
    );
    const nextCursor =
      rows.length === HISTORY_PAGE ? rows[rows.length - 1].id : null;
    return { items, nextCursor };
  }

  async editMessage(messageId: string, userId: string, body: string) {
    if (!body || !body.trim()) {
      throw new BadRequestException('Message body is required');
    }
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { authorId: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit this message');
    }
    const updated = stripDeletedReply(
      await this.prisma.message.update({
        where: { id: messageId },
        data: { body, editedAt: new Date(), updatedBy: userId },
        include: {
          author: memberUserSelect,
          reactions: { include: { user: memberUserSelect } },
          replyTo: replyToInclude,
        },
      }),
    );
    this.emitToConvo(updated.conversationId, 'chat:message:updated', updated);
    return updated;
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    if (!emoji || emoji.length > 16) {
      throw new BadRequestException('Invalid emoji');
    }
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    await this.assertMember(message.conversationId, userId);

    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });
    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.messageReaction.create({ data: { messageId, userId, emoji } });
    }

    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      include: { user: memberUserSelect },
    });
    this.emitToConvo(message.conversationId, 'chat:message:reaction', {
      messageId,
      reactions,
    });
    return reactions;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { authorId: true, conversationId: true },
    });
    if (!message) throw new NotFoundException('Message not found');

    if (message.authorId !== userId) {
      const owner = await this.prisma.conversationMember.findFirst({
        where: {
          conversationId: message.conversationId,
          userId,
          role: 'owner',
        },
        select: { id: true },
      });
      if (!owner) {
        throw new ForbiddenException(
          'Only the author or a channel owner can delete this message',
        );
      }
    }

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), updatedBy: userId },
    });
    this.emitToConvo(message.conversationId, 'chat:message:deleted', {
      id: messageId,
      conversationId: message.conversationId,
    });
    return { id: deleted.id, deletedAt: deleted.deletedAt };
  }

  async markRead(conversationId: string, userId: string) {
    const lastReadAt = new Date();
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt, updatedBy: userId },
    });
    this.emitToConvo(conversationId, 'chat:read', {
      conversationId,
      userId,
      lastReadAt,
    });
    return { conversationId, lastReadAt };
  }

  async createAttachmentMessage(
    conversationId: string,
    authorId: string,
    file: Express.Multer.File,
    body?: string,
  ) {
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          authorId,
          body: body?.trim() ? body : '',
          createdBy: authorId,
        },
      });
      await tx.messageAttachment.create({
        data: {
          messageId: created.id,
          filename: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          createdBy: authorId,
        },
      });
      return tx.message.findUnique({
        where: { id: created.id },
        include: { author: memberUserSelect, attachments: true },
      });
    });
    this.emitToConvo(conversationId, 'chat:message:new', message);
    return message;
  }

  /** Resolves an attachment's disk location, asserting the requester is a member. */
  async getAttachmentForDownload(attachmentId: string, userId: string) {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      include: { message: { select: { conversationId: true } } },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.assertMember(attachment.message.conversationId, userId);
    return {
      conversationId: attachment.message.conversationId,
      storedName: attachment.storedName,
      filename: attachment.filename,
    };
  }
}
