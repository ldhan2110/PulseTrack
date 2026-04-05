import { describe, it, expect, vi } from 'vitest';
import { SystemRolesGuard } from './system-roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { SYSTEM_ROLES_KEY } from './system-roles.decorator';

function createMockExecutionContext(user: any, requiredRoles?: string[]) {
  const mockHandler = vi.fn();
  const mockClass = vi.fn();

  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
    if (key === SYSTEM_ROLES_KEY) return requiredRoles ?? undefined;
    return undefined;
  });

  const mockContext = {
    getHandler: () => mockHandler,
    getClass: () => mockClass,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;

  return { mockContext, reflector };
}

describe('SystemRolesGuard', () => {
  it('allows request when user has required system role (admin)', () => {
    const user = { id: '1', role: 'admin' };
    const { mockContext, reflector } = createMockExecutionContext(user, ['admin']);
    const guard = new SystemRolesGuard(reflector);
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('denies request when user lacks required system role', () => {
    const user = { id: '1', role: 'member' };
    const { mockContext, reflector } = createMockExecutionContext(user, ['admin']);
    const guard = new SystemRolesGuard(reflector);
    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(mockContext)).toThrow('Insufficient system role');
  });

  it('allows request when no @SystemRoles decorator is present', () => {
    const user = { id: '1', role: 'member' };
    const { mockContext, reflector } = createMockExecutionContext(user, undefined);
    const guard = new SystemRolesGuard(reflector);
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('allows request when user matches one of multiple required roles', () => {
    const user = { id: '1', role: 'member' };
    const { mockContext, reflector } = createMockExecutionContext(user, ['admin', 'member']);
    const guard = new SystemRolesGuard(reflector);
    expect(guard.canActivate(mockContext)).toBe(true);
  });
});
