import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestCasesService } from './test-cases.service';

describe('TestCasesService', () => {
  let service: TestCasesService;
  let prisma: any;

  const mockTestCase = {
    id: 'tc1',
    testCaseKey: 'PRJ-TC-1',
    title: 'Login flow',
    preconditions: 'User exists',
    expectedResult: 'User is logged in',
    priority: 'HIGH',
    status: 'DRAFT',
    tags: ['auth'],
    estimatedMinutes: 10,
    moduleId: 'mod1',
    projectId: 'p1',
    creatorId: 'u1',
    steps: [{ id: 's1', position: 0, action: 'Click login', expectedResult: 'Form shows' }],
    links: [],
    module: { id: 'mod1', name: 'Auth' },
    creator: { id: 'u1', username: 'alice', email: 'a@b.c', name: 'Alice', imageUrl: null },
  };

  beforeEach(() => {
    prisma = {
      testCase: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      testCaseStep: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      testCaseLink: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      project: {
        update: vi.fn(),
      },
      testSuiteMember: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        createMany: vi.fn(),
      },
      $transaction: vi.fn((cb: any) => cb(prisma)),
    };
    service = new TestCasesService(prisma);
  });

  it('findAll returns test cases for a project', async () => {
    prisma.testCase.findMany.mockResolvedValue([mockTestCase]);
    const result = await service.findAll('p1');
    expect(result).toEqual([mockTestCase]);
    expect(prisma.testCase.findMany).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
      include: expect.objectContaining({ steps: expect.any(Object) }),
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findAll applies moduleId filter', async () => {
    prisma.testCase.findMany.mockResolvedValue([]);
    await service.findAll('p1', { moduleId: 'mod1' });
    expect(prisma.testCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'p1', moduleId: 'mod1' },
      }),
    );
  });

  it('findAll applies search filter with OR clause', async () => {
    prisma.testCase.findMany.mockResolvedValue([]);
    await service.findAll('p1', { search: 'login' });
    const call = prisma.testCase.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { title: { contains: 'login', mode: 'insensitive' } },
      { testCaseKey: { contains: 'login', mode: 'insensitive' } },
    ]);
  });

  it('findAll applies suiteId filter via suiteMemberships', async () => {
    prisma.testCase.findMany.mockResolvedValue([]);
    await service.findAll('p1', { suiteId: 'suite1' });
    const call = prisma.testCase.findMany.mock.calls[0][0];
    expect(call.where.suiteMemberships).toEqual({ some: { suiteId: 'suite1' } });
  });

  it('findOne returns a single test case by id', async () => {
    prisma.testCase.findUnique.mockResolvedValue(mockTestCase);
    const result = await service.findOne('tc1');
    expect(result).toEqual(mockTestCase);
    expect(prisma.testCase.findUnique).toHaveBeenCalledWith({
      where: { id: 'tc1' },
      include: expect.objectContaining({ steps: expect.any(Object) }),
    });
  });

  it('findByKey returns a test case by its key', async () => {
    prisma.testCase.findFirst.mockResolvedValue(mockTestCase);
    const result = await service.findByKey('PRJ-TC-1');
    expect(result).toEqual(mockTestCase);
    expect(prisma.testCase.findFirst).toHaveBeenCalledWith({
      where: { testCaseKey: 'PRJ-TC-1' },
      include: expect.objectContaining({ steps: expect.any(Object) }),
    });
  });

  it('create generates a testCaseKey and creates the test case', async () => {
    prisma.project.update.mockResolvedValue({ prefix: 'PRJ', testCaseSeq: 5 });
    prisma.testCase.create.mockResolvedValue({ id: 'tc-new' });
    prisma.testCase.findUniqueOrThrow.mockResolvedValue({ ...mockTestCase, id: 'tc-new' });

    const dto = {
      title: 'New test',
      moduleId: 'mod1',
      priority: 'HIGH' as any,
      steps: [{ position: 0, action: 'Do thing', expectedResult: 'Thing done' }],
    };

    const result = await service.create('p1', 'u1', dto);
    expect(result.id).toBe('tc-new');
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { testCaseSeq: { increment: 1 } },
      select: { prefix: true, testCaseSeq: true },
    });
    expect(prisma.testCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'p1',
        creatorId: 'u1',
        testCaseKey: 'PRJ-TC-5',
        title: 'New test',
      }),
    });
    expect(prisma.testCaseStep.createMany).toHaveBeenCalled();
  });

  it('create sets testCaseKey to null when project has no prefix', async () => {
    prisma.project.update.mockResolvedValue({ prefix: null, testCaseSeq: 1 });
    prisma.testCase.create.mockResolvedValue({ id: 'tc-new' });
    prisma.testCase.findUniqueOrThrow.mockResolvedValue(mockTestCase);

    await service.create('p1', 'u1', { title: 'Test', moduleId: 'mod1' });
    expect(prisma.testCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ testCaseKey: null }),
    });
  });

  it('create handles links when provided', async () => {
    prisma.project.update.mockResolvedValue({ prefix: 'PRJ', testCaseSeq: 1 });
    prisma.testCase.create.mockResolvedValue({ id: 'tc-new' });
    prisma.testCase.findUniqueOrThrow.mockResolvedValue(mockTestCase);

    await service.create('p1', 'u1', {
      title: 'Test',
      moduleId: 'mod1',
      links: [{ entityType: 'TASK', entityId: 'task1' }],
    });
    expect(prisma.testCaseLink.createMany).toHaveBeenCalledWith({
      data: [{ testCaseId: 'tc-new', entityType: 'TASK', entityId: 'task1' }],
    });
  });

  describe('update (rename and modify)', () => {
    it('renames a test case by updating title', async () => {
      prisma.testCase.update.mockResolvedValue({});
      prisma.testCase.findUniqueOrThrow.mockResolvedValue({
        ...mockTestCase,
        title: 'Renamed test',
      });

      const result = await service.update('tc1', { title: 'Renamed test' });
      expect(result.title).toBe('Renamed test');
      expect(prisma.testCase.update).toHaveBeenCalledWith({
        where: { id: 'tc1' },
        data: { title: 'Renamed test' },
      });
    });

    it('updates multiple fields at once', async () => {
      prisma.testCase.update.mockResolvedValue({});
      prisma.testCase.findUniqueOrThrow.mockResolvedValue(mockTestCase);

      await service.update('tc1', {
        title: 'Updated',
        priority: 'LOW' as any,
        status: 'APPROVED' as any,
        tags: ['new-tag'],
      });
      expect(prisma.testCase.update).toHaveBeenCalledWith({
        where: { id: 'tc1' },
        data: {
          title: 'Updated',
          priority: 'LOW',
          status: 'APPROVED',
          tags: ['new-tag'],
        },
      });
    });

    it('replaces steps when steps are provided', async () => {
      prisma.testCase.update.mockResolvedValue({});
      prisma.testCase.findUniqueOrThrow.mockResolvedValue(mockTestCase);

      await service.update('tc1', {
        steps: [{ position: 0, action: 'New step', expectedResult: 'New result' }],
      });
      expect(prisma.testCaseStep.deleteMany).toHaveBeenCalledWith({
        where: { testCaseId: 'tc1' },
      });
      expect(prisma.testCaseStep.createMany).toHaveBeenCalledWith({
        data: [{ testCaseId: 'tc1', position: 0, action: 'New step', expectedResult: 'New result' }],
      });
    });

    it('clears steps when empty array is provided', async () => {
      prisma.testCase.update.mockResolvedValue({});
      prisma.testCase.findUniqueOrThrow.mockResolvedValue(mockTestCase);

      await service.update('tc1', { steps: [] });
      expect(prisma.testCaseStep.deleteMany).toHaveBeenCalledWith({
        where: { testCaseId: 'tc1' },
      });
      expect(prisma.testCaseStep.createMany).not.toHaveBeenCalled();
    });

    it('replaces links when links are provided', async () => {
      prisma.testCase.update.mockResolvedValue({});
      prisma.testCase.findUniqueOrThrow.mockResolvedValue(mockTestCase);

      await service.update('tc1', {
        links: [{ entityType: 'BUG', entityId: 'bug1' }],
      });
      expect(prisma.testCaseLink.deleteMany).toHaveBeenCalledWith({
        where: { testCaseId: 'tc1' },
      });
      expect(prisma.testCaseLink.createMany).toHaveBeenCalledWith({
        data: [{ testCaseId: 'tc1', entityType: 'BUG', entityId: 'bug1' }],
      });
    });

    it('does not touch steps or links when not provided', async () => {
      prisma.testCase.update.mockResolvedValue({});
      prisma.testCase.findUniqueOrThrow.mockResolvedValue(mockTestCase);

      await service.update('tc1', { title: 'Only title' });
      expect(prisma.testCaseStep.deleteMany).not.toHaveBeenCalled();
      expect(prisma.testCaseLink.deleteMany).not.toHaveBeenCalled();
    });
  });

  it('delete removes a test case', async () => {
    prisma.testCase.delete.mockResolvedValue(mockTestCase);
    const result = await service.delete('tc1');
    expect(result).toEqual(mockTestCase);
    expect(prisma.testCase.delete).toHaveBeenCalledWith({ where: { id: 'tc1' } });
  });

  describe('bulkAddToSuite', () => {
    it('adds new test cases to a suite, skipping duplicates', async () => {
      prisma.testSuiteMember.findMany.mockResolvedValue([{ testCaseId: 'tc1' }]);
      prisma.testSuiteMember.findFirst.mockResolvedValue({ position: 2 });
      prisma.testSuiteMember.createMany.mockResolvedValue({ count: 1 });

      const result = await service.bulkAddToSuite('suite1', ['tc1', 'tc2']);
      expect(result).toEqual({ added: 1 });
      expect(prisma.testSuiteMember.createMany).toHaveBeenCalledWith({
        data: [{ suiteId: 'suite1', testCaseId: 'tc2', position: 3 }],
      });
    });

    it('returns added: 0 when all test cases are already members', async () => {
      prisma.testSuiteMember.findMany.mockResolvedValue([
        { testCaseId: 'tc1' },
        { testCaseId: 'tc2' },
      ]);

      const result = await service.bulkAddToSuite('suite1', ['tc1', 'tc2']);
      expect(result).toEqual({ added: 0 });
      expect(prisma.testSuiteMember.createMany).not.toHaveBeenCalled();
    });

    it('starts at position 0 when suite has no existing members', async () => {
      prisma.testSuiteMember.findMany.mockResolvedValue([]);
      prisma.testSuiteMember.findFirst.mockResolvedValue(null);
      prisma.testSuiteMember.createMany.mockResolvedValue({ count: 2 });

      await service.bulkAddToSuite('suite1', ['tc1', 'tc2']);
      expect(prisma.testSuiteMember.createMany).toHaveBeenCalledWith({
        data: [
          { suiteId: 'suite1', testCaseId: 'tc1', position: 0 },
          { suiteId: 'suite1', testCaseId: 'tc2', position: 1 },
        ],
      });
    });
  });
});
