import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { SprintsService } from './sprints.service';

describe('SprintsService', () => {
  let service: SprintsService;

  const mockPrismaService = {
    sprint: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SprintsService(mockPrismaService as any);
  });

  describe('create()', () => {
    it('creates a sprint with PLANNED status', async () => {
      const projectId = 'proj-1';
      const dto = {
        name: 'Sprint 1',
        startDate: '2026-04-10',
        endDate: '2026-04-24',
      };
      const createdSprint = {
        id: 'sprint-1',
        projectId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: 'PLANNED',
      };

      mockPrismaService.sprint.create.mockResolvedValue(createdSprint);

      const result = await service.create(projectId, dto);

      expect(result.status).toBe('PLANNED');
      expect(mockPrismaService.sprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId,
            name: dto.name,
            status: 'PLANNED',
          }),
        }),
      );
    });

    it('throws BadRequestException when endDate <= startDate', async () => {
      const projectId = 'proj-1';
      const dto = {
        name: 'Bad Sprint',
        startDate: '2026-04-24',
        endDate: '2026-04-10',
      };

      await expect(service.create(projectId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.sprint.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when endDate equals startDate', async () => {
      const projectId = 'proj-1';
      const dto = {
        name: 'Same Day Sprint',
        startDate: '2026-04-10',
        endDate: '2026-04-10',
      };

      await expect(service.create(projectId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('activate()', () => {
    it('activates a sprint when no active sprint exists in the project', async () => {
      const sprintId = 'sprint-1';
      const activatedSprint = { id: sprintId, status: 'ACTIVE', projectId: 'proj-1' };

      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          sprint: {
            findUnique: vi.fn().mockResolvedValue({ projectId: 'proj-1' }),
            count: vi.fn().mockResolvedValue(0),
            update: vi.fn().mockResolvedValue(activatedSprint),
          },
        };
        return fn(tx);
      });

      const result = await service.activate(sprintId);

      expect(result.status).toBe('ACTIVE');
    });

    it('throws ConflictException when project already has an active sprint', async () => {
      const sprintId = 'sprint-2';

      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          sprint: {
            findUnique: vi.fn().mockResolvedValue({ projectId: 'proj-1' }),
            count: vi.fn().mockResolvedValue(1),
            update: vi.fn(),
          },
        };
        return fn(tx);
      });

      await expect(service.activate(sprintId)).rejects.toThrow(ConflictException);
    });
  });

  describe('closeSprint()', () => {
    it('moves non-DONE tasks to backlog and sets sprint status to COMPLETED', async () => {
      const sprintId = 'sprint-1';
      const completedSprint = { id: sprintId, status: 'COMPLETED', projectId: 'proj-1' };

      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          task: {
            updateMany: vi.fn().mockResolvedValue({ count: 3 }),
          },
          sprint: {
            update: vi.fn().mockResolvedValue(completedSprint),
          },
        };
        return fn(tx);
      });

      const result = await service.closeSprint(sprintId);

      expect(result.sprint.status).toBe('COMPLETED');
      expect(result.movedToBacklog).toBe(3);
    });

    it('handles sprint close with 0 tasks to move (all tasks DONE)', async () => {
      const sprintId = 'sprint-1';
      const completedSprint = { id: sprintId, status: 'COMPLETED', projectId: 'proj-1' };

      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          task: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
          sprint: {
            update: vi.fn().mockResolvedValue(completedSprint),
          },
        };
        return fn(tx);
      });

      const result = await service.closeSprint(sprintId);

      expect(result.sprint.status).toBe('COMPLETED');
      expect(result.movedToBacklog).toBe(0);
    });
  });
});
