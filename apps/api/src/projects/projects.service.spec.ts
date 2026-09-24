import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
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
