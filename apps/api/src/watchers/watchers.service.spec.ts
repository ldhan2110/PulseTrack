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

  it('getWatcherUserIds returns just user IDs', async () => {
    prisma.ticketWatcher.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    const ids = await service.getWatcherUserIds('BUG' as any, 'b1');
    expect(ids).toEqual(['u1', 'u2']);
  });
});
