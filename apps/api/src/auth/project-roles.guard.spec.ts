import { describe, it, expect, vi } from 'vitest';
import { ProjectRolesGuard } from './project-roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { PERMISSION_KEY } from './require-permission.decorator';
import { SYSTEM_ROLE_PERMISSIONS, DEFAULT_MEMBER_PERMISSIONS } from './permissions';

function createMockContext(
  user: any,
  params: Record<string, string>,
  requiredPermission: { area: string; action: string } | undefined,
  mockFindUnique: any,
) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
    if (key === PERMISSION_KEY) return requiredPermission ?? undefined;
    return undefined;
  });

  const mockPrisma = {
    projectMember: { findUnique: mockFindUnique },
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
  it('allows system role regardless of permission', async () => {
    const user = { id: 'user-1' };
    const member = {
      id: 'pm-1', projectId: 'proj-1', userId: 'user-1', roleId: 'role-1',
      customRole: { id: 'role-1', isSystem: true, permissions: SYSTEM_ROLE_PERMISSIONS },
    };
    const mockFindUnique = vi.fn().mockResolvedValue(member);
    const { mockExecutionContext, reflector, mockPrisma } = createMockContext(
      user, { projectId: 'proj-1' }, { area: 'tasks', action: 'delete' }, mockFindUnique,
    );
    const guard = new ProjectRolesGuard(reflector, mockPrisma);
    expect(await guard.canActivate(mockExecutionContext)).toBe(true);
  });

  it('allows request when member has required permission', async () => {
    const user = { id: 'user-1' };
    const member = {
      id: 'pm-1', projectId: 'proj-1', userId: 'user-1', roleId: 'role-2',
      customRole: { id: 'role-2', isSystem: false, permissions: DEFAULT_MEMBER_PERMISSIONS },
    };
    const mockFindUnique = vi.fn().mockResolvedValue(member);
    const { mockExecutionContext, reflector, mockPrisma } = createMockContext(
      user, { projectId: 'proj-1' }, { area: 'tasks', action: 'create' }, mockFindUnique,
    );
    const guard = new ProjectRolesGuard(reflector, mockPrisma);
    expect(await guard.canActivate(mockExecutionContext)).toBe(true);
  });

  it('throws when member lacks required permission', async () => {
    const user = { id: 'user-1' };
    const member = {
      id: 'pm-1', projectId: 'proj-1', userId: 'user-1', roleId: 'role-2',
      customRole: { id: 'role-2', isSystem: false, permissions: DEFAULT_MEMBER_PERMISSIONS },
    };
    const mockFindUnique = vi.fn().mockResolvedValue(member);
    const { mockExecutionContext, reflector, mockPrisma } = createMockContext(
      user, { projectId: 'proj-1' }, { area: 'tasks', action: 'delete' }, mockFindUnique,
    );
    const guard = new ProjectRolesGuard(reflector, mockPrisma);
    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
  });

  it('throws when user is not a project member', async () => {
    const user = { id: 'user-1' };
    const mockFindUnique = vi.fn().mockResolvedValue(null);
    const { mockExecutionContext, reflector, mockPrisma } = createMockContext(
      user, { projectId: 'proj-1' }, { area: 'tasks', action: 'create' }, mockFindUnique,
    );
    const guard = new ProjectRolesGuard(reflector, mockPrisma);
    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Not a member of this project');
  });

  it('allows when route has no projectId param', async () => {
    const user = { id: 'user-1' };
    const mockFindUnique = vi.fn();
    const { mockExecutionContext, reflector, mockPrisma } = createMockContext(
      user, { sessionId: 'sess-1' }, { area: 'tasks', action: 'create' }, mockFindUnique,
    );
    const guard = new ProjectRolesGuard(reflector, mockPrisma);
    expect(await guard.canActivate(mockExecutionContext)).toBe(true);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('allows when no decorator present (membership only)', async () => {
    const user = { id: 'user-1' };
    const member = {
      id: 'pm-1', projectId: 'proj-1', userId: 'user-1', roleId: 'role-2',
      customRole: { id: 'role-2', isSystem: false, permissions: DEFAULT_MEMBER_PERMISSIONS },
    };
    const mockFindUnique = vi.fn().mockResolvedValue(member);
    const { mockExecutionContext, reflector, mockPrisma } = createMockContext(
      user, { projectId: 'proj-1' }, undefined, mockFindUnique,
    );
    const guard = new ProjectRolesGuard(reflector, mockPrisma);
    expect(await guard.canActivate(mockExecutionContext)).toBe(true);
  });
});
