import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WatchersService } from './watchers.service';

describe('WatchersService', () => {
  let service: WatchersService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      ticketWatcher: {
        findMany: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      taskHistory: {
        create: vi.fn(),
      },
    };
    service = new WatchersService(prisma);
  });

  it('findAll returns watchers for a task', async () => {
    const watchers = [{ id: 'w1', userId: 'u1', entityType: 'TASK', entityId: 't1', user: { id: 'u1', username: 'alice' } }];
    prisma.ticketWatcher.findMany.mockResolvedValue(watchers);
    const result = await service.findAll('TASK' as any, 't1');
    expect(result).toEqual(watchers);
    expect(prisma.ticketWatcher.findMany).toHaveBeenCalledWith({
      where: { entityType: 'TASK', entityId: 't1' },
      include: { user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } } },
    });
  });

  it('addWatchers creates watcher records, skipping duplicates', async () => {
    prisma.ticketWatcher.createMany.mockResolvedValue({ count: 2 });
    await service.addWatchers('TASK' as any, 't1', ['u1', 'u2']);
    expect(prisma.ticketWatcher.createMany).toHaveBeenCalledWith({
      data: [
        { entityType: 'TASK', entityId: 't1', userId: 'u1' },
        { entityType: 'TASK', entityId: 't1', userId: 'u2' },
      ],
      skipDuplicates: true,
    });
  });

  it('removeWatcher deletes a watcher record', async () => {
    prisma.ticketWatcher.deleteMany.mockResolvedValue({ count: 1 });
    await service.removeWatcher('TASK' as any, 't1', 'u1');
    expect(prisma.ticketWatcher.deleteMany).toHaveBeenCalledWith({
      where: { entityType: 'TASK', entityId: 't1', userId: 'u1' },
    });
  });

  it('addWatchers records task history when actorId is provided', async () => {
    prisma.ticketWatcher.createMany.mockResolvedValue({ count: 2 });
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'Alice', username: 'alice' },
      { id: 'u2', name: null, username: 'bob' },
    ]);
    prisma.taskHistory.create.mockResolvedValue({});

    await service.addWatchers('TASK' as any, 't1', ['u1', 'u2'], 'actor1');

    expect(prisma.taskHistory.create).toHaveBeenCalledWith({
      data: {
        taskId: 't1',
        actorId: 'actor1',
        field: 'watcher_added',
        oldValue: null,
        newValue: 'Alice, bob',
      },
    });
  });

  it('addWatchers skips history for BUG entity type', async () => {
    prisma.ticketWatcher.createMany.mockResolvedValue({ count: 1 });
    await service.addWatchers('BUG' as any, 'b1', ['u1'], 'actor1');
    expect(prisma.taskHistory.create).not.toHaveBeenCalled();
  });

  it('removeWatcher records task history when actorId is provided', async () => {
    prisma.user.findUnique.mockResolvedValue({ name: 'Alice', username: 'alice' });
    prisma.ticketWatcher.deleteMany.mockResolvedValue({ count: 1 });
    prisma.taskHistory.create.mockResolvedValue({});

    await service.removeWatcher('TASK' as any, 't1', 'u1', 'actor1');

    expect(prisma.taskHistory.create).toHaveBeenCalledWith({
      data: {
        taskId: 't1',
        actorId: 'actor1',
        field: 'watcher_removed',
        oldValue: 'Alice',
        newValue: null,
      },
    });
  });

  it('removeWatcher skips history for BUG entity type', async () => {
    prisma.ticketWatcher.deleteMany.mockResolvedValue({ count: 1 });
    await service.removeWatcher('BUG' as any, 'b1', 'u1', 'actor1');
    expect(prisma.taskHistory.create).not.toHaveBeenCalled();
  });

  it('getWatcherUserIds returns just user IDs', async () => {
    prisma.ticketWatcher.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    const ids = await service.getWatcherUserIds('BUG' as any, 'b1');
    expect(ids).toEqual(['u1', 'u2']);
  });
});
