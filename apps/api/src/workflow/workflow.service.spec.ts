import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowService } from './workflow.service';

function makePrisma() {
  const tx = {
    workflowStatus: {
      create: vi.fn(({ data }: any) => Promise.resolve({ id: `id-${data.key}`, ...data })),
    },
    workflowTransition: { create: vi.fn(() => Promise.resolve({})) },
  };
  return {
    tx,
    workflowStatus: { count: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(tx)),
  };
}

describe('WorkflowService.seedDefaultWorkflow', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: WorkflowService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new WorkflowService(prisma as any);
  });

  it('seeds the 8 default TASK statuses in order with correct flags [req-1]', async () => {
    prisma.workflowStatus.count.mockResolvedValue(0);

    await service.seedDefaultWorkflow('p1');

    const created = prisma.tx.workflowStatus.create.mock.calls.map((c) => c[0].data);
    expect(created.map((s) => s.key)).toEqual([
      'RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'ON_HOLD', 'REJECTED', 'CANCELED',
    ]);
    expect(created.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // every row is kind TASK for this project
    expect(created.every((s) => s.kind === 'TASK' && s.projectId === 'p1')).toBe(true);
    // exactly one default: RECEIVED
    const defaults = created.filter((s) => s.isDefault).map((s) => s.key);
    expect(defaults).toEqual(['RECEIVED']);
    // closed set: DONE, REJECTED, CANCELED
    const closed = created.filter((s) => s.isClosed).map((s) => s.key);
    expect(closed).toEqual(['DONE', 'REJECTED', 'CANCELED']);
  });

  it('seeds exactly the intended transition edges [req-2]', async () => {
    prisma.workflowStatus.count.mockResolvedValue(0);

    await service.seedDefaultWorkflow('p1');

    const edges = prisma.tx.workflowTransition.create.mock.calls
      .map((c) => `${c[0].data.fromStatusId}->${c[0].data.toStatusId}`)
      .sort();
    const expected = [
      ['RECEIVED', 'ASSIGNED'],
      ['ASSIGNED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'REVIEW'],
      ['REVIEW', 'DONE'],
      ['REVIEW', 'IN_PROGRESS'],
      ['ASSIGNED', 'ON_HOLD'],
      ['ON_HOLD', 'ASSIGNED'],
      ['IN_PROGRESS', 'ON_HOLD'],
      ['ON_HOLD', 'IN_PROGRESS'],
      ['REVIEW', 'ON_HOLD'],
      ['ON_HOLD', 'REVIEW'],
      ['ASSIGNED', 'REJECTED'],
      ['IN_PROGRESS', 'REJECTED'],
      ['REVIEW', 'REJECTED'],
      ['RECEIVED', 'CANCELED'],
      ['ASSIGNED', 'CANCELED'],
      ['IN_PROGRESS', 'CANCELED'],
      ['REVIEW', 'CANCELED'],
    ]
      .map(([f, t]) => `id-${f}->id-${t}`)
      .sort();
    expect(edges).toEqual(expected);
  });

  it('returns early without writes when TASK statuses already exist [req-3]', async () => {
    prisma.workflowStatus.count.mockResolvedValue(1);

    await service.seedDefaultWorkflow('p1');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.tx.workflowStatus.create).not.toHaveBeenCalled();
    expect(prisma.tx.workflowTransition.create).not.toHaveBeenCalled();
  });
});
