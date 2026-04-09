import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestSuitesService } from './test-suites.service';

describe('TestSuitesService', () => {
  let service: TestSuitesService;
  let prisma: any;

  const mockSuite = {
    id: 'suite1',
    name: 'Smoke Tests',
    description: 'Basic smoke tests',
    projectId: 'p1',
    _count: { members: 2 },
  };

  beforeEach(() => {
    prisma = {
      testSuite: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      testSuiteMember: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        createMany: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new TestSuitesService(prisma);
  });

  it('findAll returns suites for a project', async () => {
    prisma.testSuite.findMany.mockResolvedValue([mockSuite]);
    const result = await service.findAll('p1');
    expect(result).toEqual([mockSuite]);
    expect(prisma.testSuite.findMany).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findOne returns a suite with its members', async () => {
    const suiteWithMembers = { ...mockSuite, members: [] };
    prisma.testSuite.findUnique.mockResolvedValue(suiteWithMembers);
    const result = await service.findOne('suite1');
    expect(result).toEqual(suiteWithMembers);
    expect(prisma.testSuite.findUnique).toHaveBeenCalledWith({
      where: { id: 'suite1' },
      include: expect.objectContaining({
        _count: { select: { members: true } },
        members: expect.any(Object),
      }),
    });
  });

  it('create creates a suite with name and description', async () => {
    prisma.testSuite.create.mockResolvedValue(mockSuite);
    const result = await service.create('p1', { name: 'Smoke Tests', description: 'Basic smoke tests' });
    expect(result).toEqual(mockSuite);
    expect(prisma.testSuite.create).toHaveBeenCalledWith({
      data: { projectId: 'p1', name: 'Smoke Tests', description: 'Basic smoke tests' },
      include: { _count: { select: { members: true } } },
    });
  });

  describe('update (rename)', () => {
    it('renames a suite by updating name', async () => {
      prisma.testSuite.update.mockResolvedValue({ ...mockSuite, name: 'Regression Tests' });

      const result = await service.update('suite1', { name: 'Regression Tests' });
      expect(result.name).toBe('Regression Tests');
      expect(prisma.testSuite.update).toHaveBeenCalledWith({
        where: { id: 'suite1' },
        data: { name: 'Regression Tests' },
        include: { _count: { select: { members: true } } },
      });
    });

    it('updates description without changing name', async () => {
      prisma.testSuite.update.mockResolvedValue({ ...mockSuite, description: 'Updated desc' });

      await service.update('suite1', { description: 'Updated desc' });
      expect(prisma.testSuite.update).toHaveBeenCalledWith({
        where: { id: 'suite1' },
        data: { description: 'Updated desc' },
        include: { _count: { select: { members: true } } },
      });
    });

    it('skips undefined fields in update data', async () => {
      prisma.testSuite.update.mockResolvedValue(mockSuite);

      await service.update('suite1', {});
      expect(prisma.testSuite.update).toHaveBeenCalledWith({
        where: { id: 'suite1' },
        data: {},
        include: { _count: { select: { members: true } } },
      });
    });
  });

  it('delete removes a suite', async () => {
    prisma.testSuite.delete.mockResolvedValue(mockSuite);
    const result = await service.delete('suite1');
    expect(result).toEqual(mockSuite);
    expect(prisma.testSuite.delete).toHaveBeenCalledWith({ where: { id: 'suite1' } });
  });

  describe('addMembers', () => {
    it('adds new members to a suite, skipping duplicates', async () => {
      prisma.testSuiteMember.findMany.mockResolvedValue([{ testCaseId: 'tc1' }]);
      prisma.testSuiteMember.findFirst.mockResolvedValue({ position: 1 });
      prisma.testSuiteMember.createMany.mockResolvedValue({ count: 1 });

      const result = await service.addMembers('suite1', ['tc1', 'tc2']);
      expect(result).toEqual({ added: 1 });
      expect(prisma.testSuiteMember.createMany).toHaveBeenCalledWith({
        data: [{ suiteId: 'suite1', testCaseId: 'tc2', position: 2 }],
      });
    });

    it('returns added: 0 when all are already members', async () => {
      prisma.testSuiteMember.findMany.mockResolvedValue([
        { testCaseId: 'tc1' },
        { testCaseId: 'tc2' },
      ]);

      const result = await service.addMembers('suite1', ['tc1', 'tc2']);
      expect(result).toEqual({ added: 0 });
      expect(prisma.testSuiteMember.createMany).not.toHaveBeenCalled();
    });

    it('starts at position 0 when suite is empty', async () => {
      prisma.testSuiteMember.findMany.mockResolvedValue([]);
      prisma.testSuiteMember.findFirst.mockResolvedValue(null);
      prisma.testSuiteMember.createMany.mockResolvedValue({ count: 2 });

      await service.addMembers('suite1', ['tc1', 'tc2']);
      expect(prisma.testSuiteMember.createMany).toHaveBeenCalledWith({
        data: [
          { suiteId: 'suite1', testCaseId: 'tc1', position: 0 },
          { suiteId: 'suite1', testCaseId: 'tc2', position: 1 },
        ],
      });
    });
  });

  it('removeMember deletes a suite member by composite key', async () => {
    prisma.testSuiteMember.delete.mockResolvedValue({});
    await service.removeMember('suite1', 'tc1');
    expect(prisma.testSuiteMember.delete).toHaveBeenCalledWith({
      where: { suiteId_testCaseId: { suiteId: 'suite1', testCaseId: 'tc1' } },
    });
  });
});
