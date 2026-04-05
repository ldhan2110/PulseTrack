import { describe, it, expect, vi } from 'vitest';
import { ProjectRolesGuard } from './project-roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { PROJECT_ROLES_KEY } from './project-roles.decorator';

function createMockContext(
  user: any,
  params: Record<string, string>,
  requiredRoles: string[] | undefined,
  mockFindUnique: any,
) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
    if (key === PROJECT_ROLES_KEY) return requiredRoles ?? undefined;
    return undefined;
  });

  const mockPrisma = {
    projectMember: {
      findUnique: mockFindUnique,
    },
  } as any;

  const mockExecutionContext = {
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user, params }),
    }),
  } as any;

  return { mockExecutionContext, reflector, mockPrisma };
}

describe('ProjectRolesGuard', () => {
  it('allows request when user is a project member with the required role', async () => {
    const user = { id: 'user-1' };
    const member = { id: 'pm-1', projectId: 'proj-1', userId: 'user-1', role: 'pm' };
    const mockFindUnique = vi.fn().mockResolvedValue(member);
    const { mockExecutionContext, reflector, mockPrisma } = createMockContext(
      user,
      { projectId: 'proj-1' },
      ['pm'],
      mockFindUnique,
    );
    const guard = new ProjectRolesGuard(reflector, mockPrisma);
    const result = await guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: 'proj-1', userId: 'user-1' } },
    });
  });

  it('throws ForbiddenException when user is not a member of the project', async () => {
    const user = { id: 'user-1' };
    const mockFindUnique = vi.fn().mockResolvedValue(null);
    const { mockExecutionContext, reflector, mockPrisma } = createMockContext(
      user,
      { projectId: 'proj-1' },
      ['pm'],
      mockFindUnique,
    );
    const guard = new ProjectRolesGuard(reflector, mockPrisma);
    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      'Not a member of this project',
    );
  });

  it('throws ForbiddenException when user is a member but lacks the required project role', async () => {
    const user = { id: 'user-1' };
    const member = { id: 'pm-1', projectId: 'proj-1', userId: 'user-1', role: 'developer' };
    const mockFindUnique = vi.fn().mockResolvedValue(member);
    const { mockExecutionContext, reflector, mockPrisma } = createMockContext(
      user,
      { projectId: 'proj-1' },
      ['pm'],
      mockFindUnique,
    );
    const guard = new ProjectRolesGuard(reflector, mockPrisma);
    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      'Insufficient project role',
    );
  });

  it('allows request when no @ProjectRoles decorator is present (membership check only)', async () => {
    const user = { id: 'user-1' };
    const member = { id: 'pm-1', projectId: 'proj-1', userId: 'user-1', role: 'developer' };
    const mockFindUnique = vi.fn().mockResolvedValue(member);
    const { mockExecutionContext, reflector, mockPrisma } = createMockContext(
      user,
      { projectId: 'proj-1' },
      undefined,
      mockFindUnique,
    );
    const guard = new ProjectRolesGuard(reflector, mockPrisma);
    const result = await guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });
});
