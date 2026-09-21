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

  /** Hard-deletes only the caller's own membership; leaves messages + peers intact. */
  async leaveConversation(conversationId: string, userId: string) {
    await this.prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return { deleted: true };
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
      if (existing) return existing;

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
      where: { userId },
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
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: m.conversationId,
            authorId: { not: userId },
            deletedAt: null,
            ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          },
        });
        const last = m.conversation.messages[0];
        return {
          ...m.conversation,
          messages: undefined,
          lastMessage: last
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
    clientTempId?: string,
  ) {
    if (!body || !body.trim()) {
      throw new BadRequestException('Message body is required');
    }
    const created = await this.prisma.message.create({
      data: { conversationId, authorId, body, createdBy: authorId },
      include: { author: memberUserSelect, reactions: { include: { user: memberUserSelect } } },
    });
    // Transient echo (not persisted) so the sender can match its optimistic message.
    const message = { ...created, clientTempId };
    this.emitToConvo(conversationId, 'chat:message:new', message);
    return message;
  }

  async getMessages(conversationId: string, cursor?: string) {
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: memberUserSelect,
        attachments: true,
        reactions: { include: { user: memberUserSelect } },
      },
    });
    const items = rows.map((m) => (m.deletedAt ? { ...m, body: '' } : m));
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
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { body, editedAt: new Date(), updatedBy: userId },
      include: { author: memberUserSelect, reactions: { include: { user: memberUserSelect } } },
    });
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
