import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ConversationType } from '@prisma/client';

// Minimal in-memory Prisma fake — enough for ChatService's queries.
function makePrisma() {
  const conversations: any[] = [];
  const members: any[] = [];
  const messages: any[] = [];
  const projectMembers: any[] = [
    { projectId: 'p1', userId: 'u1' },
    { projectId: 'p1', userId: 'u2' },
    // u3 is NOT a project member
  ];
  let seq = 0;
  const id = (p: string) => `${p}${++seq}`;

  const prisma: any = {
    conversation: {
      findFirst: async ({ where }: any) =>
        conversations
          .map((c) => withMembers(c))
          .find(
            (c) =>
              c.projectId === where.projectId &&
              (where.type ? c.type === where.type : true) &&
              (where.AND
                ? where.AND.every((a: any) =>
                    c.members.some((m: any) => m.userId === a.members.some.userId),
                  )
                : true),
          ) ?? null,
      findMany: async ({ where }: any) => {
        let list = conversations.filter(
          (c) => c.projectId === where.projectId && (where.type ? c.type === where.type : true),
        );
        if (where.members?.some?.userId) {
          list = list.filter((c) =>
            members.some((m) => m.conversationId === c.id && m.userId === where.members.some.userId),
          );
        }
        return list.map((c) => withMembers(c));
      },
      findUnique: async ({ where }: any) => {
        const c = conversations.find((x) => x.id === where.id);
        return c ? withMembers(c) : null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const c = conversations.find((x) => x.id === where.id);
        if (!c) throw new Error('not found');
        return withMembers(c);
      },
      create: async ({ data }: any) => {
        const c = { id: id('c'), projectId: data.projectId, type: data.type, updatedAt: new Date() };
        conversations.push(c);
        if (data.members?.create) {
          for (const m of data.members.create) {
            members.push({ id: id('m'), conversationId: c.id, userId: m.userId, lastReadAt: null });
          }
        }
        return withMembers(c);
      },
      update: async ({ where, data }: any) => {
        const c = conversations.find((x) => x.id === where.id);
        Object.assign(c, data);
        return c;
      },
    },
    conversationMember: {
      findUnique: async ({ where }: any) => {
        const k = where.conversationId_userId;
        return members.find((m) => m.conversationId === k.conversationId && m.userId === k.userId) ?? null;
      },
      upsert: async ({ where, create }: any) => {
        const k = where.conversationId_userId;
        let m = members.find((x) => x.conversationId === k.conversationId && x.userId === k.userId);
        if (!m) {
          m = { id: id('m'), conversationId: create.conversationId, userId: create.userId, lastReadAt: null };
          members.push(m);
        }
        return m;
      },
      update: async ({ where, data }: any) => {
        const k = where.conversationId_userId;
        const m = members.find((x) => x.conversationId === k.conversationId && x.userId === k.userId);
        Object.assign(m, data);
        return m;
      },
    },
    message: {
      count: async ({ where }: any) =>
        messages.filter(
          (m) =>
            m.conversationId === where.conversationId &&
            (where.createdAt?.gt ? m.createdAt > where.createdAt.gt : true),
        ).length,
      findMany: async ({ where }: any) =>
        messages
          .filter((m) => m.conversationId === where.conversationId)
          .sort((a, b) => b.createdAt - a.createdAt),
      create: async ({ data }: any) => {
        const m = { id: id('msg'), ...data, createdAt: new Date() };
        messages.push(m);
        return m;
      },
    },
    projectMember: {
      count: async ({ where }: any) =>
        projectMembers.filter(
          (m) => m.projectId === where.projectId && where.userId.in.includes(m.userId),
        ).length,
    },
    $transaction: async (fn: any) => fn(prisma),
  };

  function withMembers(c: any) {
    return { ...c, members: members.filter((m) => m.conversationId === c.id) };
  }

  return { prisma, conversations, members, messages };
}

describe('ChatService', () => {
  let svc: ChatService;
  let db: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    db = makePrisma();
    svc = new ChatService(db.prisma as any);
  });

  it('lazy-creates the PROJECT channel and is idempotent', async () => {
    const first = await svc.listConversations('p1', 'u1');
    const second = await svc.listConversations('p1', 'u1');
    const channels = db.conversations.filter((c) => c.type === ConversationType.PROJECT);
    expect(channels).toHaveLength(1);
    expect(first[0].id).toBe(second[0].id);
    expect(first[0].type).toBe(ConversationType.PROJECT);
  });

  it('reuses a DM regardless of open order', async () => {
    const a = await svc.openDirect('p1', 'u1', 'u2');
    const b = await svc.openDirect('p1', 'u2', 'u1');
    expect(b.id).toBe(a.id);
    expect(db.conversations.filter((c) => c.type === ConversationType.DIRECT)).toHaveLength(1);
  });

  it('rejects a DM with a non-project-member', async () => {
    await expect(svc.openDirect('p1', 'u1', 'u3')).rejects.toThrow();
  });

  it('counts unread messages after lastReadAt', async () => {
    const [channel] = await svc.listConversations('p1', 'u1');
    await svc.listConversations('p1', 'u2'); // u2 joins the channel
    await svc.sendMessage(channel.id, 'u2', 'hi');
    await svc.sendMessage(channel.id, 'u2', 'again');
    const list = await svc.listConversations('p1', 'u1');
    expect(list[0].unreadCount).toBe(2);
    await svc.markRead(channel.id, 'u1');
    const after = await svc.listConversations('p1', 'u1');
    expect(after[0].unreadCount).toBe(0);
  });

  it('blocks a non-member from sending or reading', async () => {
    const dm = await svc.openDirect('p1', 'u1', 'u2');
    await expect(svc.sendMessage(dm.id, 'u3', 'hi')).rejects.toThrow();
    await expect(svc.markRead(dm.id, 'u3')).rejects.toThrow();
    await expect(svc.getMessages(dm.id, 'u3')).rejects.toThrow();
  });

  it('rejects an empty body', async () => {
    const [channel] = await svc.listConversations('p1', 'u1');
    await expect(svc.sendMessage(channel.id, 'u1', '   ')).rejects.toThrow();
  });

  it('emits chat:new to the project room for a PROJECT conversation', async () => {
    const [channel] = await svc.listConversations('p1', 'u1');
    const emit = vi.fn();
    svc.setGateway({ emitMessage: emit });
    await svc.sendMessage(channel.id, 'u1', 'hello');
    expect(emit).toHaveBeenCalledWith({ projectId: 'p1' }, expect.objectContaining({ body: 'hello' }));
  });

  it('emits chat:new to each member user room for a DIRECT conversation', async () => {
    const dm = await svc.openDirect('p1', 'u1', 'u2');
    const emit = vi.fn();
    svc.setGateway({ emitMessage: emit });
    await svc.sendMessage(dm.id, 'u1', 'yo');
    const [audience] = emit.mock.calls[0];
    expect(audience.userIds.sort()).toEqual(['u1', 'u2']);
  });
});

describe('ChatGateway.emitMessage', () => {
  function makeServer() {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    return { server: { to } as any, to, emit };
  }

  it('routes PROJECT audience to the project room', () => {
    const gw = new ChatGateway({} as any, {} as any);
    const { server, to } = makeServer();
    gw.server = server;
    gw.emitMessage({ projectId: 'p1' }, { body: 'x' });
    expect(to).toHaveBeenCalledWith('project:p1');
  });

  it('routes DIRECT audience to each user room', () => {
    const gw = new ChatGateway({} as any, {} as any);
    const { server, to } = makeServer();
    gw.server = server;
    gw.emitMessage({ userIds: ['u1', 'u2'] }, { body: 'x' });
    expect(to).toHaveBeenCalledWith('user:u1');
    expect(to).toHaveBeenCalledWith('user:u2');
  });
});
