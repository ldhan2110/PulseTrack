import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from './search.service';

function makePrisma() {
  return {
    projectMember: { findMany: vi.fn() },
    project: { findMany: vi.fn() },
    task: { findMany: vi.fn() },
  };
}

describe('SearchService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: SearchService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new SearchService(prisma as any);
  });

  it('returns matching member projects and tasks', async () => {
    prisma.projectMember.findMany.mockResolvedValue([{ projectId: 'p1' }]);
    prisma.project.findMany.mockResolvedValue([
      { id: 'p1', name: 'PulseTrack', prefix: 'PM', avatarUrl: null },
    ]);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        taskKey: 'PM-1',
        title: 'Login',
        project: { name: 'PulseTrack', prefix: 'PM' },
        workflowStatus: { name: 'To Do' },
      },
    ]);

    const res = await service.search('u1', 'login');

    expect(res.projects).toHaveLength(1);
    expect(res.tasks[0]).toMatchObject({
      id: 't1',
      taskKey: 'PM-1',
      projectPrefix: 'PM',
      projectName: 'PulseTrack',
      statusName: 'To Do',
    });
    // membership filter is the RBAC — both queries constrained to my project ids
    expect(prisma.project.findMany.mock.calls[0][0].where.id).toEqual({
      in: ['p1'],
    });
    expect(prisma.task.findMany.mock.calls[0][0].where.projectId).toEqual({
      in: ['p1'],
    });
  });

  it('never returns data for a non-member (no memberships → empty, no project/task query)', async () => {
    prisma.projectMember.findMany.mockResolvedValue([]);

    const res = await service.search('outsider', 'PulseTrack');

    expect(res).toEqual({ projects: [], tasks: [] });
    expect(prisma.project.findMany).not.toHaveBeenCalled();
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('orders an exact task-key match ahead of fuzzy title matches (case-insensitive)', async () => {
    prisma.projectMember.findMany.mockResolvedValue([{ projectId: 'p1' }]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'fuzzy',
        taskKey: 'PM-99',
        title: 'contains pm-42 in title',
        project: { name: 'P', prefix: 'PM' },
        workflowStatus: null,
      },
      {
        id: 'exact',
        taskKey: 'PM-42',
        title: 'Something else',
        project: { name: 'P', prefix: 'PM' },
        workflowStatus: null,
      },
    ]);

    const res = await service.search('u1', 'pm-42');

    expect(res.tasks[0].id).toBe('exact');
    expect(res.tasks[0].statusName).toBeNull();
  });

  it('excludes archived projects and draft tasks via query filters', async () => {
    prisma.projectMember.findMany.mockResolvedValue([{ projectId: 'p1' }]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValue([]);

    await service.search('u1', 'x');

    expect(prisma.project.findMany.mock.calls[0][0].where.archived).toBe(false);
    expect(prisma.task.findMany.mock.calls[0][0].where.isDraft).toBe(false);
  });

  it('returns empty and does not hit the DB for an empty/whitespace query', async () => {
    const res = await service.search('u1', '   ');

    expect(res).toEqual({ projects: [], tasks: [] });
    expect(prisma.projectMember.findMany).not.toHaveBeenCalled();
    expect(prisma.project.findMany).not.toHaveBeenCalled();
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });
});
