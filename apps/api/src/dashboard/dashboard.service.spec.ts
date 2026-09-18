import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service';

// getMyWork's date/status filtering lives in the Prisma `where` clause, so we
// assert the where clauses; getActivity's merge/sort/cap is real JS, tested with data.

function makePrisma() {
  return {
    workflowStatus: { findMany: vi.fn() },
    task: { count: vi.fn(), findMany: vi.fn() },
    bug: { count: vi.fn(), findMany: vi.fn() },
    comment: { findMany: vi.fn() },
  } as any;
}

describe('DashboardService.getMyWork', () => {
  let prisma: any;
  let service: DashboardService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new DashboardService(prisma);
    prisma.workflowStatus.findMany.mockResolvedValue([
      { id: 'bugOpen', isClosed: false },
      { id: 'bugDone', isClosed: true },
    ]);
    // task.count order: openTasks, dueSoon, overdue
    prisma.task.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prisma.bug.count.mockResolvedValue(3);
  });

  it('counts open tasks against non-closed task statuses only', async () => {
    const taskStatuses = [
      { id: 'open', isClosed: false },
      { id: 'done', isClosed: true },
    ];
    const result = await (service as any).getMyWork('p1', 'u1', taskStatuses);

    expect(result).toEqual({ openTasks: 4, dueSoon: 2, overdue: 1, myBugs: 3 });

    const openWhere = prisma.task.count.mock.calls[0][0].where;
    expect(openWhere).toMatchObject({
      projectId: 'p1',
      assigneeId: 'u1',
      workflowStatusId: { in: ['open'] },
    });
  });

  it('dueSoon uses a 48h forward window; overdue uses < now', async () => {
    const taskStatuses = [{ id: 'open', isClosed: false }];
    await (service as any).getMyWork('p1', 'u1', taskStatuses);

    const dueSoonWhere = prisma.task.count.mock.calls[1][0].where;
    const overdueWhere = prisma.task.count.mock.calls[2][0].where;

    const gte = dueSoonWhere.plannedEndDate.gte.getTime();
    const lte = dueSoonWhere.plannedEndDate.lte.getTime();
    expect(lte - gte).toBe(48 * 60 * 60 * 1000);

    expect(overdueWhere.plannedEndDate).toHaveProperty('lt');
    // null plannedEndDate can't satisfy gte/lte/lt, so it's neither dueSoon nor overdue.
  });

  it('my bugs count uses non-closed bug statuses', async () => {
    await (service as any).getMyWork('p1', 'u1', [{ id: 'open', isClosed: false }]);
    const bugWhere = prisma.bug.count.mock.calls[0][0].where;
    expect(bugWhere).toMatchObject({
      projectId: 'p1',
      assigneeId: 'u1',
      workflowStatusId: { in: ['bugOpen'] },
    });
  });
});

describe('DashboardService.getActivity', () => {
  let prisma: any;
  let service: DashboardService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new DashboardService(prisma);
  });

  it('merges task/bug/comment events newest-first and caps at 15', async () => {
    const mk = (n: number) => new Date(2026, 0, n).toISOString();
    prisma.task.findMany.mockResolvedValue([
      { taskKey: 'PT-1', updatedAt: new Date(2026, 0, 10), assignee: { name: 'Ann' } },
    ]);
    prisma.bug.findMany.mockResolvedValue([
      { bugKey: 'PT-BUG-1', updatedAt: new Date(2026, 0, 25), assignee: { name: 'Bob' } },
    ]);
    prisma.comment.findMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        createdAt: new Date(2026, 0, i + 1),
        author: { name: 'Cid' },
        task: { taskKey: `C-${i}` },
        bug: null,
      })),
    );

    const items = await (service as any).getActivity('p1');

    expect(items).toHaveLength(15);
    // newest-first: bug on day 20 leads
    expect(items[0]).toMatchObject({ actor: 'Bob', targetKey: 'PT-BUG-1', verb: 'updated' });
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].at >= items[i].at).toBe(true);
    }
    void mk;
  });

  it('returns [] when the project has no activity', async () => {
    prisma.task.findMany.mockResolvedValue([]);
    prisma.bug.findMany.mockResolvedValue([]);
    prisma.comment.findMany.mockResolvedValue([]);

    const items = await (service as any).getActivity('p1');
    expect(items).toEqual([]);
  });
});
