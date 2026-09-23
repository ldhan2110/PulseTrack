import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConversationType } from '@prisma/client';
import { ChatService } from './chat.service';

function makePrisma() {
  return {
    conversation: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    conversationMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    message: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    messageAttachment: { create: vi.fn(), findUnique: vi.fn() },
    messageReaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;
}

describe('ChatService.createConversation', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
  });

  it('channel: creator is owner, listed members join as member', async () => {
    prisma.conversation.create.mockResolvedValue({ id: 'c1' });
    await service.createConversation('u1', {
      type: ConversationType.CHANNEL,
      name: 'general',
      memberIds: ['u2', 'u3', 'u1'],
    });

    const data = prisma.conversation.create.mock.calls[0][0].data;
    expect(data.type).toBe(ConversationType.CHANNEL);
    expect(data.creatorId).toBe('u1');
    const created = data.members.create;
    expect(created).toContainEqual({ userId: 'u1', role: 'owner', createdBy: 'u1' });
    expect(created).toContainEqual({ userId: 'u2', role: 'member', createdBy: 'u1' });
    // creator deduped out of the member list, appears only as owner
    expect(created.filter((m: any) => m.userId === 'u1')).toHaveLength(1);
  });

  it('DM dedupe: returns the existing DM, creates no second row', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: 'dm1' });
    const result = await service.createConversation('u1', {
      type: ConversationType.DM,
      memberIds: ['u2'],
    });

    expect(result).toEqual({ id: 'dm1' });
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });
});

describe('ChatService.leaveConversation (DM soft-close)', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
  });

  it('DM: soft-hides the caller (deletedAt+clearedAt), never hard-deletes', async () => {
    prisma.conversation.findUnique.mockResolvedValue({ type: ConversationType.DM });
    await service.leaveConversation('dm1', 'u1');

    expect(prisma.conversationMember.delete).not.toHaveBeenCalled();
    const data = prisma.conversationMember.update.mock.calls[0][0].data;
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(data.clearedAt).toBeInstanceOf(Date);
  });

  it('channel: hard-deletes the membership', async () => {
    prisma.conversation.findUnique.mockResolvedValue({ type: ConversationType.CHANNEL });
    await service.leaveConversation('c1', 'u1');
    expect(prisma.conversationMember.delete).toHaveBeenCalled();
  });

  it('reopen: un-hides caller and resets the message floor', async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'dm1',
      members: [{ userId: 'u1', deletedAt: new Date() }],
    });
    await service.createConversation('u1', {
      type: ConversationType.DM,
      memberIds: ['u2'],
    });

    const data = prisma.conversationMember.update.mock.calls[0][0].data;
    expect(data.deletedAt).toBeNull();
    expect(data.clearedAt).toBeInstanceOf(Date);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });
});

describe('ChatService.listMyConversations', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
  });

  it('unread count excludes the members own and deleted messages', async () => {
    const lastReadAt = new Date(2026, 0, 1);
    prisma.conversationMember.findMany.mockResolvedValue([
      { conversationId: 'c1', lastReadAt, conversation: { id: 'c1', messages: [] } },
    ]);
    prisma.message.count.mockResolvedValue(2);

    const result = await service.listMyConversations('u1');

    const where = prisma.message.count.mock.calls[0][0].where;
    expect(where).toMatchObject({
      conversationId: 'c1',
      authorId: { not: 'u1' },
      deletedAt: null,
      createdAt: { gt: lastReadAt },
    });
    expect(result[0].unreadCount).toBe(2);
  });
});

describe('ChatService.sendMessage', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
  });

  it('persists a message with author + audit fields', async () => {
    prisma.message.create.mockResolvedValue({ id: 'm1' });
    await service.sendMessage('c1', 'u1', 'hi');

    const data = prisma.message.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      conversationId: 'c1',
      authorId: 'u1',
      body: 'hi',
      createdBy: 'u1',
    });
  });

  it('rejects an empty/whitespace body with 400', async () => {
    await expect(service.sendMessage('c1', 'u1', '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('a normal message stores replyToId as undefined (not a reply)', async () => {
    prisma.message.create.mockResolvedValue({ id: 'm1' });
    await service.sendMessage('c1', 'u1', 'hi');
    expect(prisma.message.create.mock.calls[0][0].data.replyToId).toBeUndefined();
  });

  it('a reply to a message in the same conversation persists replyToId', async () => {
    prisma.message.findUnique.mockResolvedValue({ conversationId: 'c1' });
    prisma.message.create.mockResolvedValue({ id: 'm2', replyTo: null });
    await service.sendMessage('c1', 'u1', 'reply', 'r1');

    expect(prisma.message.findUnique).toHaveBeenCalledWith({
      where: { id: 'r1' },
      select: { conversationId: true },
    });
    expect(prisma.message.create.mock.calls[0][0].data.replyToId).toBe('r1');
  });

  it('rejects a reply whose target is in another conversation with 400', async () => {
    prisma.message.findUnique.mockResolvedValue({ conversationId: 'other' });
    await expect(
      service.sendMessage('c1', 'u1', 'reply', 'r1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('rejects a reply whose target does not exist with 400', async () => {
    prisma.message.findUnique.mockResolvedValue(null);
    await expect(
      service.sendMessage('c1', 'u1', 'reply', 'gone'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});

describe('ChatService.getMessages', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
  });

  it('first page returns 30 newest desc + a nextCursor', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `m${i}`,
      deletedAt: null,
      body: `b${i}`,
    }));
    prisma.message.findMany.mockResolvedValue(rows);

    const { items, nextCursor } = await service.getMessages('c1', 'u1');

    const args = prisma.message.findMany.mock.calls[0][0];
    expect(args.take).toBe(30);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.cursor).toBeUndefined();
    expect(items).toHaveLength(30);
    expect(nextCursor).toBe('m29');
  });

  it('with a cursor pages older via cursor+skip; no nextCursor under a full page', async () => {
    prisma.message.findMany.mockResolvedValue([
      { id: 'm40', deletedAt: null, body: 'x' },
    ]);

    const { nextCursor } = await service.getMessages('c1', 'u1', 'm29');

    const args = prisma.message.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: 'm29' });
    expect(args.skip).toBe(1);
    expect(nextCursor).toBeNull();
  });

  it('omits the body of a soft-deleted message', async () => {
    prisma.message.findMany.mockResolvedValue([
      { id: 'm1', deletedAt: new Date(), body: 'secret' },
    ]);

    const { items } = await service.getMessages('c1', 'u1');
    expect(items[0].body).toBe('');
  });

  it('a reply carries its parent preview via replyTo include', async () => {
    prisma.message.findMany.mockResolvedValue([
      {
        id: 'm1',
        deletedAt: null,
        body: 'reply',
        replyTo: { id: 'p1', body: 'parent', deletedAt: null, author: { id: 'u2' } },
      },
    ]);

    const { items } = await service.getMessages('c1', 'u1');
    expect(prisma.message.findMany.mock.calls[0][0].include.replyTo).toBeDefined();
    expect(items[0].replyTo).toMatchObject({ id: 'p1', body: 'parent' });
  });

  it('blanks the preview body when the parent is soft-deleted', async () => {
    prisma.message.findMany.mockResolvedValue([
      {
        id: 'm1',
        deletedAt: null,
        body: 'reply',
        replyTo: { id: 'p1', body: 'gone', deletedAt: new Date(), author: { id: 'u2' } },
      },
    ]);

    const { items } = await service.getMessages('c1', 'u1');
    expect(items[0].replyTo.body).toBe('');
  });
});

describe('ChatService.editMessage', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
    prisma.message.update.mockResolvedValue({ id: 'm1', conversationId: 'c1' });
  });

  it('author edits: sets body + editedAt + updatedBy', async () => {
    prisma.message.findUnique.mockResolvedValue({ authorId: 'u1' });
    await service.editMessage('m1', 'u1', 'new');

    const data = prisma.message.update.mock.calls[0][0].data;
    expect(data.body).toBe('new');
    expect(data.updatedBy).toBe('u1');
    expect(data.editedAt).toBeInstanceOf(Date);
  });

  it('non-author is denied 403', async () => {
    prisma.message.findUnique.mockResolvedValue({ authorId: 'u1' });
    await expect(service.editMessage('m1', 'u2', 'x')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.message.update).not.toHaveBeenCalled();
  });
});

describe('ChatService.deleteMessage', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
    prisma.message.update.mockResolvedValue({ id: 'm1', deletedAt: new Date() });
  });

  it('author soft-deletes: sets deletedAt, keeps the row', async () => {
    prisma.message.findUnique.mockResolvedValue({
      authorId: 'u1',
      conversationId: 'c1',
    });
    await service.deleteMessage('m1', 'u1');

    const data = prisma.message.update.mock.calls[0][0].data;
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(data.updatedBy).toBe('u1');
  });

  it('channel owner deletes another members message', async () => {
    prisma.message.findUnique.mockResolvedValue({
      authorId: 'u1',
      conversationId: 'c1',
    });
    prisma.conversationMember.findFirst.mockResolvedValue({ id: 'owner-m' });
    await service.deleteMessage('m1', 'u2');
    expect(prisma.message.update).toHaveBeenCalled();
  });

  it('a non-author non-owner member is denied 403', async () => {
    prisma.message.findUnique.mockResolvedValue({
      authorId: 'u1',
      conversationId: 'c1',
    });
    prisma.conversationMember.findFirst.mockResolvedValue(null);
    await expect(service.deleteMessage('m1', 'u3')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.message.update).not.toHaveBeenCalled();
  });
});

describe('ChatService.markRead', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
    prisma.conversationMember.update.mockResolvedValue({});
  });

  it('bumps lastReadAt to now for the member', async () => {
    await service.markRead('c1', 'u1');
    const call = prisma.conversationMember.update.mock.calls[0][0];
    expect(call.where).toEqual({
      conversationId_userId: { conversationId: 'c1', userId: 'u1' },
    });
    expect(call.data.lastReadAt).toBeInstanceOf(Date);
    expect(call.data.updatedBy).toBe('u1');
  });

  it('after read, the unread count drops to 0 (createdAt > lastReadAt window)', async () => {
    const { lastReadAt } = await service.markRead('c1', 'u1');
    // list with the freshly-bumped lastReadAt: no message is newer than now
    prisma.conversationMember.findMany.mockResolvedValue([
      { conversationId: 'c1', lastReadAt, conversation: { id: 'c1', messages: [] } },
    ]);
    prisma.message.count.mockResolvedValue(0);

    const result = await service.listMyConversations('u1');
    expect(prisma.message.count.mock.calls[0][0].where.createdAt).toEqual({
      gt: lastReadAt,
    });
    expect(result[0].unreadCount).toBe(0);
  });
});

describe('ChatService attachments', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
    // run the transaction callback against the same mock prisma
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
  });

  it('upload creates a MessageAttachment row with storedName/mimeType/size', async () => {
    prisma.message.create.mockResolvedValue({ id: 'm1' });
    prisma.messageAttachment.create.mockResolvedValue({});
    prisma.message.findUnique.mockResolvedValue({ id: 'm1', attachments: [] });

    const file = {
      originalname: 'photo.png',
      filename: 'uuid.png',
      mimetype: 'image/png',
      size: 1234,
    } as any;

    await service.createAttachmentMessage('c1', 'u1', file);

    const data = prisma.messageAttachment.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      messageId: 'm1',
      filename: 'photo.png',
      storedName: 'uuid.png',
      mimeType: 'image/png',
      size: 1234,
      createdBy: 'u1',
    });
  });

  it('download by a non-member is denied 403', async () => {
    prisma.messageAttachment.findUnique.mockResolvedValue({
      storedName: 'uuid.png',
      filename: 'photo.png',
      message: { conversationId: 'c1' },
    });
    prisma.conversationMember.findUnique.mockResolvedValue(null); // not a member

    await expect(
      service.getAttachmentForDownload('a1', 'stranger'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ChatService.toggleReaction', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
    prisma.message.findUnique.mockResolvedValue({ id: 'm1', conversationId: 'c1' });
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'member-1' });
  });

  it('creates a reaction when none exists, then removes it on repeat', async () => {
    prisma.messageReaction.findUnique.mockResolvedValueOnce(null);
    prisma.messageReaction.findMany.mockResolvedValueOnce([{ id: 'r1', emoji: '👍' }]);

    const created = await service.toggleReaction('m1', 'u1', '👍');
    expect(prisma.messageReaction.create).toHaveBeenCalledWith({
      data: { messageId: 'm1', userId: 'u1', emoji: '👍' },
    });
    expect(prisma.messageReaction.delete).not.toHaveBeenCalled();
    expect(created).toEqual([{ id: 'r1', emoji: '👍' }]);

    prisma.messageReaction.findUnique.mockResolvedValueOnce({ id: 'r1' });
    prisma.messageReaction.findMany.mockResolvedValueOnce([]);

    const removed = await service.toggleReaction('m1', 'u1', '👍');
    expect(prisma.messageReaction.delete).toHaveBeenCalledWith({
      where: { id: 'r1' },
    });
    expect(removed).toEqual([]);
  });

  it('throws BadRequestException for empty or oversized emoji', async () => {
    await expect(service.toggleReaction('m1', 'u1', '')).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.toggleReaction('m1', 'u1', 'x'.repeat(17)),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ChatService.addMembers', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
  });

  it('adds users as members (skipDuplicates) and returns the grown member list', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'cm-actor' });
    prisma.conversation.findUnique
      .mockResolvedValueOnce({ type: ConversationType.CHANNEL })
      .mockResolvedValueOnce({
        id: 'c1',
        members: [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }],
      });

    const result = await service.addMembers('c1', 'u1', ['u2', 'u3']);

    const call = prisma.conversationMember.createMany.mock.calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data).toContainEqual({
      conversationId: 'c1',
      userId: 'u2',
      role: 'member',
      createdBy: 'u1',
    });
    expect(result.members).toHaveLength(3);
  });

  it('rejects add on a DM with 400', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'cm-actor' });
    prisma.conversation.findUnique.mockResolvedValue({ type: ConversationType.DM });

    await expect(service.addMembers('c1', 'u1', ['u2'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.conversationMember.createMany).not.toHaveBeenCalled();
  });
});

describe('ChatService.removeMember', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
  });

  it('owner removes a member → deleted', async () => {
    prisma.conversation.findUnique
      .mockResolvedValueOnce({ type: ConversationType.CHANNEL })
      .mockResolvedValueOnce({ id: 'c1', members: [{ userId: 'u1' }] });
    prisma.conversationMember.findUnique.mockResolvedValue({ role: 'owner' });

    const result = await service.removeMember('c1', 'u1', 'u2');

    expect(prisma.conversationMember.delete).toHaveBeenCalledWith({
      where: { conversationId_userId: { conversationId: 'c1', userId: 'u2' } },
    });
    expect(result).toEqual({ removed: true });
  });

  it('non-owner remove → 403', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      type: ConversationType.CHANNEL,
    });
    prisma.conversationMember.findUnique.mockResolvedValue({ role: 'member' });

    await expect(
      service.removeMember('c1', 'u2', 'u3'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.conversationMember.delete).not.toHaveBeenCalled();
  });
});

describe('ChatService.sendMessage mention notify', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
  });

  it('notifies a mentioned member, skips non-members and self', async () => {
    prisma.message.create.mockResolvedValue({
      id: 'm1',
      author: { id: 'u1', name: 'An' },
    });
    // only u2 is a member of the conversation
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: 'u2' }]);
    const emitToUser = vi.spyOn(service, 'emitToUser');

    await service.sendMessage(
      'c1',
      'u1',
      'hi @[Bob](u2) and @[Ghost](u9) and @[Me](u1)',
    );

    // member u2 notified; non-member u9 and self u1 not
    expect(emitToUser).toHaveBeenCalledWith(
      'u2',
      'chat:mention',
      expect.objectContaining({ conversationId: 'c1', messageId: 'm1' }),
    );
    expect(emitToUser).not.toHaveBeenCalledWith('u9', 'chat:mention', expect.anything());
    expect(emitToUser).not.toHaveBeenCalledWith('u1', 'chat:mention', expect.anything());
    // members query excluded self before hitting the DB
    expect(prisma.conversationMember.findMany.mock.calls[0][0].where.userId.in).toEqual([
      'u2',
      'u9',
    ]);
  });

  it('no mention token → no notify query', async () => {
    prisma.message.create.mockResolvedValue({ id: 'm1', author: { id: 'u1', name: 'An' } });

    await service.sendMessage('c1', 'u1', 'plain @nobody message');

    expect(prisma.conversationMember.findMany).not.toHaveBeenCalled();
  });
});

describe('ChatService.leaveConversation', () => {
  let prisma: any;
  let service: ChatService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ChatService(prisma);
  });

  it('deletes only the caller membership, leaving messages + peer intact', async () => {
    prisma.conversationMember.delete.mockResolvedValue({ id: 'cm1' });

    const result = await service.leaveConversation('c1', 'u1');

    expect(prisma.conversationMember.delete).toHaveBeenCalledTimes(1);
    expect(prisma.conversationMember.delete).toHaveBeenCalledWith({
      where: { conversationId_userId: { conversationId: 'c1', userId: 'u1' } },
    });
    // peer membership + messages untouched
    expect(prisma.message.update).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: true });
  });
});

describe('ChatService.searchTargets — directory scoping (req-10)', () => {
  it('scopes to users sharing an invited project with the caller (not global, not past DMs)', async () => {
    const prisma = { user: { findMany: vi.fn().mockResolvedValue([]) } } as any;
    const service = new ChatService(prisma);

    await service.searchTargets('u1', 'bob');

    const arg = prisma.user.findMany.mock.calls[0][0];
    expect(arg.where.id).toEqual({ not: 'u1' });
    const scopeJson = JSON.stringify(arg.where.projectMembers);
    expect(scopeJson).toContain('project');
    expect(scopeJson).toContain('u1');
    // past DM partners are no longer a discovery path
    expect(JSON.stringify(arg.where)).not.toContain('conversationMemberships');
    // the text query still applies
    expect(JSON.stringify(arg.where.OR)).toContain('bob');
  });
});
