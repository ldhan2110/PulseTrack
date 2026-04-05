import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BugsService } from './bugs.service';

describe('BugsService', () => {
  let service: BugsService;

  const mockPrismaService = {
    bug: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BugsService(mockPrismaService as any);
  });

  describe('create()', () => {
    it('creates a bug with reporterId set from parameter', async () => {
      const projectId = 'proj-1';
      const reporterId = 'user-1';
      const dto = {
        title: 'Login button not working',
        severity: 'HIGH' as any,
      };
      const createdBug = {
        id: 'bug-1',
        projectId,
        reporterId,
        title: dto.title,
        severity: 'HIGH',
        status: 'OPEN',
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com' },
        assignee: null,
      };

      mockPrismaService.bug.create.mockResolvedValue(createdBug);

      const result = await service.create(projectId, reporterId, dto);

      expect(result.reporterId).toBe(reporterId);
      expect(mockPrismaService.bug.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ projectId, reporterId, title: dto.title }),
        }),
      );
    });

    it('creates bug with CRITICAL severity', async () => {
      const projectId = 'proj-1';
      const reporterId = 'user-1';
      const dto = {
        title: 'Database connection fails',
        severity: 'CRITICAL' as any,
        description: 'Cannot connect to DB',
        reproductionSteps: '1. Start server\n2. Observe crash',
      };
      const createdBug = {
        id: 'bug-2',
        projectId,
        reporterId,
        title: dto.title,
        severity: 'CRITICAL',
        status: 'OPEN',
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com' },
        assignee: null,
      };

      mockPrismaService.bug.create.mockResolvedValue(createdBug);

      const result = await service.create(projectId, reporterId, dto);

      expect(result.severity).toBe('CRITICAL');
    });

    it('creates bug with MEDIUM severity and optional fields', async () => {
      const projectId = 'proj-1';
      const reporterId = 'user-2';
      const dto = {
        title: 'Dropdown misaligned',
        severity: 'MEDIUM' as any,
        environment: 'Chrome 120 on macOS',
      };
      const createdBug = {
        id: 'bug-3',
        projectId,
        reporterId,
        title: dto.title,
        severity: 'MEDIUM',
        environment: dto.environment,
        status: 'OPEN',
        reporter: { id: 'user-2', username: 'dev', email: 'dev@test.com' },
        assignee: null,
      };

      mockPrismaService.bug.create.mockResolvedValue(createdBug);

      const result = await service.create(projectId, reporterId, dto);

      expect(result.severity).toBe('MEDIUM');
      expect(result.environment).toBe(dto.environment);
    });
  });

  describe('update()', () => {
    it('updates bug status from OPEN to IN_FIX', async () => {
      const bugId = 'bug-1';
      const dto = { status: 'IN_FIX' as any };
      const updatedBug = {
        id: bugId,
        status: 'IN_FIX',
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com' },
        assignee: null,
      };

      mockPrismaService.bug.update.mockResolvedValue(updatedBug);

      const result = await service.update(bugId, dto);

      expect(result.status).toBe('IN_FIX');
      expect(mockPrismaService.bug.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: bugId },
          data: expect.objectContaining({ status: 'IN_FIX' }),
        }),
      );
    });

    it('transitions bug status to VERIFIED', async () => {
      const bugId = 'bug-1';
      const dto = { status: 'VERIFIED' as any };
      const updatedBug = {
        id: bugId,
        status: 'VERIFIED',
        reporter: { id: 'user-1', username: 'qcuser', email: 'qc@test.com' },
        assignee: null,
      };

      mockPrismaService.bug.update.mockResolvedValue(updatedBug);

      const result = await service.update(bugId, dto);

      expect(result.status).toBe('VERIFIED');
    });
  });
});
