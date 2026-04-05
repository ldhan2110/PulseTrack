import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectsService } from './projects.service';
import { NotFoundException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;

  const mockPrismaService = {
    project: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    projectMember: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectsService(mockPrismaService as any);
  });

  describe('create()', () => {
    it('creates a project and auto-adds creator as PM member in a transaction', async () => {
      const projectId = 'proj-1';
      const userId = 'user-1';
      const dto = { name: 'Test Project', description: 'A test project' };
      const createdProject = {
        id: projectId,
        name: dto.name,
        description: dto.description,
        ownerId: userId,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          project: { create: vi.fn().mockResolvedValue(createdProject) },
          projectMember: {
            create: vi.fn().mockResolvedValue({ id: 'member-1', projectId, userId, role: 'pm' }),
          },
        };
        return fn(tx);
      });

      const result = await service.create(userId, dto);

      expect(result).toEqual(createdProject);
      expect(mockPrismaService.$transaction).toHaveBeenCalledOnce();
    });

    it('sets ownerId to the creator userId and creates a PM member', async () => {
      const userId = 'owner-user';
      const dto = { name: 'My Project' };
      let capturedProjectData: any;
      let capturedMemberData: any;

      mockPrismaService.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          project: {
            create: vi.fn().mockImplementation((args: any) => {
              capturedProjectData = args.data;
              return Promise.resolve({ id: 'p1', ...args.data });
            }),
          },
          projectMember: {
            create: vi.fn().mockImplementation((args: any) => {
              capturedMemberData = args.data;
              return Promise.resolve({ id: 'mem-1', ...args.data });
            }),
          },
        };
        return fn(tx);
      });

      await service.create(userId, dto);

      expect(capturedProjectData.ownerId).toBe(userId);
      expect(capturedMemberData.role).toBe('pm');
      expect(capturedMemberData.userId).toBe(userId);
    });
  });

  describe('findAllForUser()', () => {
    it('returns only non-archived projects where user is a member', async () => {
      const userId = 'user-1';

      mockPrismaService.projectMember.findMany.mockResolvedValue([
        {
          role: 'pm',
          project: {
            id: 'proj-active',
            name: 'Active Project',
            description: null,
            archived: false,
            createdAt: new Date(),
            _count: { tasks: 5 },
            tasks: [{ status: 'IN_PROGRESS' }, { status: 'BLOCKED' }],
          },
        },
        {
          role: 'developer',
          project: {
            id: 'proj-archived',
            name: 'Archived Project',
            description: null,
            archived: true,
            createdAt: new Date(),
            _count: { tasks: 2 },
            tasks: [],
          },
        },
      ]);

      const result = await service.findAllForUser(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('proj-active');
      expect(result[0].userRole).toBe('pm');
      expect(result[0].taskSummary.total).toBe(5);
      expect(result[0].taskSummary.inProgress).toBe(1);
      expect(result[0].taskSummary.blocked).toBe(1);
    });

    it('returns empty array when user has no memberships', async () => {
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);
      const result = await service.findAllForUser('user-1');
      expect(result).toEqual([]);
    });

    it('excludes archived projects from the result', async () => {
      mockPrismaService.projectMember.findMany.mockResolvedValue([
        {
          role: 'pm',
          project: {
            id: 'archived-proj',
            name: 'Archived',
            description: null,
            archived: true,
            createdAt: new Date(),
            _count: { tasks: 0 },
            tasks: [],
          },
        },
      ]);
      const result = await service.findAllForUser('user-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne()', () => {
    it('throws NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('returns project with members when found', async () => {
      const project = {
        id: 'proj-1',
        name: 'Test Project',
        members: [
          {
            id: 'member-1',
            user: { id: 'user-1', email: 'test@test.com', username: 'test' },
          },
        ],
      };
      mockPrismaService.project.findUnique.mockResolvedValue(project);
      const result = await service.findOne('proj-1');
      expect(result).toEqual(project);
    });
  });

  describe('archive()', () => {
    it('sets archived to true', async () => {
      const updatedProject = { id: 'proj-1', archived: true };
      mockPrismaService.project.update.mockResolvedValue(updatedProject);

      const result = await service.archive('proj-1');

      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { archived: true },
      });
      expect(result.archived).toBe(true);
    });
  });

  describe('unarchive()', () => {
    it('sets archived to false', async () => {
      const updatedProject = { id: 'proj-1', archived: false };
      mockPrismaService.project.update.mockResolvedValue(updatedProject);

      const result = await service.unarchive('proj-1');

      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { archived: false },
      });
      expect(result.archived).toBe(false);
    });
  });
});
