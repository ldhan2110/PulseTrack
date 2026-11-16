import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TimeLogsService } from './time-logs.service';

const MEMBER = { tasks: { delete: false } } as any;
const PM = { tasks: { delete: true } } as any;

// Log tl1 belongs to user 'author' on task t1 in project p1, logged 2026-11-10.
function makeService() {
  const existing = {
    id: 'tl1',
    userId: 'author',
    taskId: 't1',
    minutes: 60,
    comment: 'old',
    loggedAt: new Date('2026-11-10T00:00:00Z'),
    task: { projectId: 'p1' },
  };
  const prisma = {
    timeLog: {
      findUnique: vi.fn(async ({ where }: any) => (where.id === 'tl1' ? existing : null)),
      update: vi.fn(async ({ data }: any) => ({ ...existing, ...data, user: { id: 'author' } })),
    },
    taskHistory: { create: vi.fn(async () => ({})) },
  };
  const notifications = { notifyProject: vi.fn() };
  const svc = new TimeLogsService(prisma as any, notifications as any);
  return { svc, prisma, notifications };
}

describe('TimeLogsService.update', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('lets the author edit minutes, comment and date, and records history', async () => {
    const res = await ctx.svc.update('p1', 't1', 'tl1', 'author', MEMBER, {
      minutes: 90,
      comment: 'fixed',
      loggedAt: '2026-11-12',
    });

    expect(ctx.prisma.timeLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tl1' },
        data: { minutes: 90, comment: 'fixed', loggedAt: new Date('2026-11-12') },
      }),
    );
    expect(res.minutes).toBe(90);
    expect(ctx.prisma.taskHistory.create).toHaveBeenCalledWith({
      data: {
        taskId: 't1',
        actorId: 'author',
        field: 'timeLog',
        oldValue: '1h — old on 2026-11-10',
        newValue: '1h 30m — fixed on 2026-11-12',
      },
    });
    expect(ctx.notifications.notifyProject).toHaveBeenCalledWith('p1', 'task:updated', expect.anything());
  });

  it('only updates the fields that were sent; a blank comment clears it', async () => {
    await ctx.svc.update('p1', 't1', 'tl1', 'author', MEMBER, { comment: '  ' });
    expect(ctx.prisma.timeLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { comment: null } }),
    );
  });

  it('lets a user with tasks:delete edit someone else’s log', async () => {
    await expect(ctx.svc.update('p1', 't1', 'tl1', 'pm', PM, { minutes: 30 })).resolves.toBeDefined();
  });

  it('rejects a non-author without tasks:delete', async () => {
    await expect(ctx.svc.update('p1', 't1', 'tl1', 'someone', MEMBER, { minutes: 30 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(ctx.prisma.timeLog.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing log, another task, or another project', async () => {
    await expect(ctx.svc.update('p1', 't1', 'nope', 'author', MEMBER, {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(ctx.svc.update('p1', 't2', 'tl1', 'author', MEMBER, {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(ctx.svc.update('p2', 't1', 'tl1', 'author', MEMBER, {})).rejects.toBeInstanceOf(NotFoundException);
    expect(ctx.prisma.timeLog.update).not.toHaveBeenCalled();
  });
});
