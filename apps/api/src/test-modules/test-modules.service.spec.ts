import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestModulesService } from './test-modules.service';

describe('TestModulesService', () => {
  let service: TestModulesService;
  let prisma: any;

  const mockModule = {
    id: 'mod1',
    name: 'Auth Module',
    position: 0,
    parentId: null,
    projectId: 'p1',
    _count: { testCases: 3 },
  };

  beforeEach(() => {
    prisma = {
      testModule: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new TestModulesService(prisma);
  });

  it('findAll returns modules for a project ordered by position', async () => {
    prisma.testModule.findMany.mockResolvedValue([mockModule]);
    const result = await service.findAll('p1');
    expect(result).toEqual([mockModule]);
    expect(prisma.testModule.findMany).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
      include: { _count: { select: { testCases: true } } },
      orderBy: { position: 'asc' },
    });
  });

  it('create auto-calculates position when not provided', async () => {
    prisma.testModule.findFirst.mockResolvedValue({ position: 4 });
    prisma.testModule.create.mockResolvedValue({ ...mockModule, position: 5 });

    const result = await service.create('p1', { name: 'New Module' });
    expect(result.position).toBe(5);
    expect(prisma.testModule.findFirst).toHaveBeenCalledWith({
      where: { projectId: 'p1', parentId: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    expect(prisma.testModule.create).toHaveBeenCalledWith({
      data: { projectId: 'p1', name: 'New Module', position: 5, parentId: undefined },
      include: { _count: { select: { testCases: true } } },
    });
  });

  it('create uses explicit position when provided', async () => {
    prisma.testModule.create.mockResolvedValue({ ...mockModule, position: 2 });

    await service.create('p1', { name: 'Module', position: 2 });
    expect(prisma.testModule.findFirst).not.toHaveBeenCalled();
    expect(prisma.testModule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 2 }),
      include: expect.any(Object),
    });
  });

  it('create starts at position 0 when no sibling modules exist', async () => {
    prisma.testModule.findFirst.mockResolvedValue(null);
    prisma.testModule.create.mockResolvedValue({ ...mockModule, position: 0 });

    await service.create('p1', { name: 'First Module' });
    expect(prisma.testModule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 0 }),
      include: expect.any(Object),
    });
  });

  it('create respects parentId for nested modules', async () => {
    prisma.testModule.findFirst.mockResolvedValue(null);
    prisma.testModule.create.mockResolvedValue({ ...mockModule, parentId: 'parent1' });

    await service.create('p1', { name: 'Child', parentId: 'parent1' });
    expect(prisma.testModule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'p1', parentId: 'parent1' },
      }),
    );
    expect(prisma.testModule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ parentId: 'parent1' }),
      include: expect.any(Object),
    });
  });

  describe('update (rename)', () => {
    it('renames a module by updating name', async () => {
      prisma.testModule.update.mockResolvedValue({ ...mockModule, name: 'Renamed Module' });

      const result = await service.update('mod1', { name: 'Renamed Module' });
      expect(result.name).toBe('Renamed Module');
      expect(prisma.testModule.update).toHaveBeenCalledWith({
        where: { id: 'mod1' },
        data: { name: 'Renamed Module' },
        include: { _count: { select: { testCases: true } } },
      });
    });

    it('updates position without changing name', async () => {
      prisma.testModule.update.mockResolvedValue({ ...mockModule, position: 3 });

      await service.update('mod1', { position: 3 });
      expect(prisma.testModule.update).toHaveBeenCalledWith({
        where: { id: 'mod1' },
        data: { position: 3 },
        include: { _count: { select: { testCases: true } } },
      });
    });

    it('updates parentId to reparent a module', async () => {
      prisma.testModule.update.mockResolvedValue({ ...mockModule, parentId: 'parent2' });

      await service.update('mod1', { parentId: 'parent2' });
      expect(prisma.testModule.update).toHaveBeenCalledWith({
        where: { id: 'mod1' },
        data: { parentId: 'parent2' },
        include: { _count: { select: { testCases: true } } },
      });
    });

    it('skips undefined fields in update data', async () => {
      prisma.testModule.update.mockResolvedValue(mockModule);

      await service.update('mod1', {});
      expect(prisma.testModule.update).toHaveBeenCalledWith({
        where: { id: 'mod1' },
        data: {},
        include: { _count: { select: { testCases: true } } },
      });
    });
  });

  it('delete removes a module', async () => {
    prisma.testModule.delete.mockResolvedValue(mockModule);
    const result = await service.delete('mod1');
    expect(result).toEqual(mockModule);
    expect(prisma.testModule.delete).toHaveBeenCalledWith({ where: { id: 'mod1' } });
  });
});
