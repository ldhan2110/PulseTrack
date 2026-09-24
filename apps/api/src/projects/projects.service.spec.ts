import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

function makePrisma() {
  return {
    project: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    projectMember: { findMany: vi.fn() },
  };
}

describe('ProjectsService — soft delete', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: ProjectsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ProjectsService(prisma as any, {} as any);
  });

  describe('remove (owner-only)', () => {
    it('owner: sets deletedAt', async () => {
      prisma.project.findUnique.mockResolvedValue({ ownerId: 'u1', deletedAt: null });
      prisma.project.update.mockResolvedValue({ id: 'p1', deletedAt: new Date() });

      await service.remove('p1', 'u1');

      expect(prisma.project.update).toHaveBeenCalledTimes(1);
      const arg = prisma.project.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'p1' });
      expect(arg.data.deletedAt).toBeInstanceOf(Date);
    });

    it('non-owner: 403 Forbidden, deletedAt unchanged (no update)', async () => {
      prisma.project.findUnique.mockResolvedValue({ ownerId: 'owner', deletedAt: null });

      await expect(service.remove('p1', 'someone-else')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('missing or already-deleted project: 404', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.remove('p1', 'u1')).rejects.toBeInstanceOf(NotFoundException);

      prisma.project.findUnique.mockResolvedValue({ ownerId: 'u1', deletedAt: new Date() });
      await expect(service.remove('p1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });
  });

  describe('findOne hides soft-deleted', () => {
    it('soft-deleted project: 404', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', deletedAt: new Date() });
      await expect(service.findOne('p1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('live project: resolves', async () => {
      const live = { id: 'p1', deletedAt: null, members: [] };
      prisma.project.findUnique.mockResolvedValue(live);
      await expect(service.findOne('p1')).resolves.toBe(live);
    });
  });

  describe('update fieldConfig', () => {
    it('persists fieldConfig when provided', async () => {
      const cfg = { storyPoints: false, taskType: false };
      prisma.project.update.mockResolvedValue({ id: 'p1', fieldConfig: cfg });

      const res = await service.update('p1', { fieldConfig: cfg } as any);

      const arg = prisma.project.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'p1' });
      expect(arg.data.fieldConfig).toEqual(cfg);
      expect(res.fieldConfig).toEqual(cfg);
    });

    it('omits fieldConfig from data when not provided', async () => {
      prisma.project.update.mockResolvedValue({ id: 'p1' });

      await service.update('p1', { name: 'X' } as any);

      const arg = prisma.project.update.mock.calls[0][0];
      expect('fieldConfig' in arg.data).toBe(false);
    });
  });

  describe('findAllForUser excludes soft-deleted', () => {
    const membership = (over: Record<string, unknown>) => ({
      customRole: { name: 'admin' },
      project: {
        id: 'p',
        name: 'P',
        description: null,
        prefix: 'P',
        avatarUrl: null,
        archived: false,
        deletedAt: null,
        createdAt: new Date(),
        workflowStatuses: [],
        tasks: [],
        members: [],
        _count: { tasks: 0 },
        ...over,
      },
    });

    it('drops deleted, keeps live', async () => {
      prisma.projectMember.findMany.mockResolvedValue([
        membership({ id: 'live' }),
        membership({ id: 'gone', deletedAt: new Date() }),
      ]);

      const res = await service.findAllForUser('u1');

      expect(res.map((p) => p.id)).toEqual(['live']);
    });
  });
});

describe('ProjectsService — task categories', () => {
  const N_DEFAULTS = 11;

  describe('create seeds defaults', () => {
    it('creates 11 task categories in the project tx', async () => {
      const tx = {
        project: { create: vi.fn().mockResolvedValue({ id: 'p1' }) },
        customRole: { create: vi.fn().mockResolvedValue({ id: 'r1' }) },
        projectMember: { create: vi.fn() },
        projectTaskType: { createMany: vi.fn() },
        projectTaskCategory: { createMany: vi.fn() },
      };
      const prisma = {
        project: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(async (cb: any) => cb(tx)),
      };
      const workflow = {
        seedDefaultWorkflow: vi.fn(),
        seedDefaultBugWorkflow: vi.fn(),
      };
      const service = new ProjectsService(prisma as any, workflow as any);

      await service.create('u1', { name: 'P', prefix: 'PM' } as any);

      expect(tx.projectTaskCategory.createMany).toHaveBeenCalledTimes(1);
      const rows = tx.projectTaskCategory.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(N_DEFAULTS);
      expect(rows[0]).toMatchObject({ projectId: 'p1', name: 'Analysis & Consulting', position: 0, createdBy: 'u1' });
      expect(rows[N_DEFAULTS - 1]).toMatchObject({ name: 'Internal', position: N_DEFAULTS - 1 });
    });
  });

  describe('getTaskCategories lazy-seed', () => {
    it('seeds 11 then returns them when the project has none', async () => {
      const seeded = Array.from({ length: N_DEFAULTS }, (_, i) => ({ id: `c${i}`, position: i }));
      const prisma = {
        projectTaskCategory: {
          findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(seeded),
          createMany: vi.fn(),
        },
      };
      const service = new ProjectsService(prisma as any, {} as any);

      const res = await service.getTaskCategories('p1');

      expect(prisma.projectTaskCategory.createMany).toHaveBeenCalledTimes(1);
      const seedArg = prisma.projectTaskCategory.createMany.mock.calls[0][0];
      expect(seedArg.data).toHaveLength(N_DEFAULTS);
      expect(seedArg.skipDuplicates).toBe(true); // race-safe for concurrent first reads
      expect(res).toHaveLength(N_DEFAULTS);
    });

    it('returns existing rows without seeding', async () => {
      const existing = [{ id: 'c1', position: 0 }];
      const prisma = {
        projectTaskCategory: { findMany: vi.fn().mockResolvedValue(existing), createMany: vi.fn() },
      };
      const service = new ProjectsService(prisma as any, {} as any);

      const res = await service.getTaskCategories('p1');

      expect(prisma.projectTaskCategory.createMany).not.toHaveBeenCalled();
      expect(res).toBe(existing);
    });
  });

  describe('setTaskCategories', () => {
    function makePrisma(existingIds: string[]) {
      return {
        projectTaskCategory: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce(existingIds.map((id) => ({ id }))) // existing lookup
            .mockResolvedValue([{ id: 'x', position: 0 }]), // final getTaskCategories read (non-empty → no lazy-seed)
          update: vi.fn(),
          create: vi.fn(),
          updateMany: vi.fn(),
          createMany: vi.fn(),
        },
        $transaction: vi.fn(async (ops: any) => Promise.all(ops)),
      };
    }

    it('adds new, renames/reorders kept, soft-deletes omitted', async () => {
      const prisma = makePrisma(['keep', 'drop']);
      const service = new ProjectsService(prisma as any, {} as any);

      await service.setTaskCategories('p1', [
        { id: 'keep', name: 'Renamed', isActive: true },
        { name: 'Brand New', isActive: true },
      ]);

      // omitted 'drop' deactivated
      expect(prisma.projectTaskCategory.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['drop'] } },
        data: { isActive: false },
      });
      // kept row updated with new name + position 0
      expect(prisma.projectTaskCategory.update).toHaveBeenCalledWith({
        where: { id: 'keep' },
        data: { name: 'Renamed', isActive: true, position: 0 },
      });
      // new row created at position 1
      expect(prisma.projectTaskCategory.create).toHaveBeenCalledWith({
        data: { projectId: 'p1', name: 'Brand New', isActive: true, position: 1 },
      });
    });

    it('rejects a payload with no active non-empty category', async () => {
      const prisma = makePrisma([]);
      const service = new ProjectsService(prisma as any, {} as any);

      await expect(
        service.setTaskCategories('p1', [{ name: 'X', isActive: false }]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
