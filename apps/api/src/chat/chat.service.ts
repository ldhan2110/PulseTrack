import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationType } from '@prisma/client';

const PAGE = 30;

// Minimal shape the gateway (wired in the live-delivery section) fulfils —
// avoids a service ↔ gateway import/DI cycle.
export type ChatAudience = { projectId: string } | { userIds: string[] };
interface MessageEmitter {
  emitMessage(audience: ChatAudience, message: unknown): void;
}

@Injectable()
export class ChatService {
  // Set by ChatGateway.afterInit to avoid a DI cycle (service ↔ gateway).
  private gateway?: MessageEmitter;
  setGateway(gateway: MessageEmitter) {
    this.gateway = gateway;
  }

  constructor(private prisma: PrismaService) {}

  private async assertMember(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this conversation');
    return member;
  }

  async listConversations(projectId: string, userId: string) {
    // Lazy-create the single PROJECT channel; idempotent via partial unique index.
    let channel = await this.prisma.conversation.findFirst({
      where: { projectId, type: ConversationType.PROJECT },
    });
    if (!channel) {
      channel = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.conversation.findFirst({
          where: { projectId, type: ConversationType.PROJECT },
        });
        if (existing) return existing;
        return tx.conversation.create({
          data: { projectId, type: ConversationType.PROJECT },
        });
      });
    }

    // Ensure the caller is a member of the project channel.
    await this.prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: channel.id, userId } },
      create: { conversationId: channel.id, userId },
      update: {},
    });

    // The channel plus the user's DMs.
    const dms = await this.prisma.conversation.findMany({
      where: {
        projectId,
        type: ConversationType.DIRECT,
        members: { some: { userId } },
      },
      include: { members: true },
      orderBy: { updatedAt: 'desc' },
    });

    const channelWithMembers = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: channel.id },
      include: { members: true },
    });

    const all = [channelWithMembers, ...dms];
    return Promise.all(
      all.map(async (c) => {
        const me = c.members.find((m) => m.userId === userId);
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            createdAt: me?.lastReadAt ? { gt: me.lastReadAt } : undefined,
          },
        });
        return { ...c, unreadCount };
      }),
    );
  }

  async openDirect(projectId: string, userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new BadRequestException('Cannot open a DM with yourself');
    }
    // Both must be members of the project.
    const memberCount = await this.prisma.projectMember.count({
      where: { projectId, userId: { in: [userId, otherUserId] } },
    });
    if (memberCount < 2) {
      throw new ForbiddenException('Both users must be project members');
    }

    // Find an existing DIRECT conversation with exactly these two members.
    const existing = await this.prisma.conversation.findFirst({
      where: {
        projectId,
        type: ConversationType.DIRECT,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: otherUserId } } },
        ],
      },
      include: { members: true },
    });
    if (existing && existing.members.length === 2) return existing;

    return this.prisma.conversation.create({
      data: {
        projectId,
        type: ConversationType.DIRECT,
        members: { create: [{ userId }, { userId: otherUserId }] },
      },
      include: { members: true },
    });
  }

  async getMessages(conversationId: string, userId: string, cursor?: string) {
    await this.assertMember(conversationId, userId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = messages.length > PAGE;
    const page = hasMore ? messages.slice(0, PAGE) : messages;
    return { messages: page, nextCursor: hasMore ? page[page.length - 1].id : null };
  }

  async sendMessage(conversationId: string, userId: string, body: string) {
    await this.assertMember(conversationId, userId);
    const trimmed = body?.trim();
    if (!trimmed) throw new BadRequestException('Message body is required');

    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { members: true },
    });

    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: { conversationId, senderId: userId, body: trimmed },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return msg;
    });

    const audience =
      conversation.type === ConversationType.PROJECT
        ? { projectId: conversation.projectId }
        : { userIds: conversation.members.map((m) => m.userId) };

    this.gateway?.emitMessage(audience, message);
    return { message, audience };
  }

  async markRead(conversationId: string, userId: string) {
    await this.assertMember(conversationId, userId);
    return this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }
}
