import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { ROLES_KEY } from './roles.decorator';

function createMockExecutionContext(user: any, handlerRoles?: string[], classRoles?: string[]) {
  const mockHandler = vi.fn();
  const mockClass = vi.fn();

  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key, targets) => {
    if (key === ROLES_KEY) {
      return handlerRoles ?? classRoles ?? undefined;
    }
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

describe('RolesGuard', () => {
  describe('canActivate', () => {
    it('allows request when user has required role (pm accessing @Roles("pm") endpoint)', () => {
      const user = { sub: 'test-sub', roles: ['pm'] };
      const { mockContext, reflector } = createMockExecutionContext(user, ['pm']);
      const guard = new RolesGuard(reflector);
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('denies request when user lacks required role (ba accessing @Roles("pm") endpoint)', () => {
      const user = { sub: 'test-sub', roles: ['ba'] };
      const { mockContext, reflector } = createMockExecutionContext(user, ['pm']);
      const guard = new RolesGuard(reflector);
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('allows request when no @Roles decorator is present (public authenticated endpoint)', () => {
      const user = { sub: 'test-sub', roles: ['ba'] };
      const { mockContext, reflector } = createMockExecutionContext(user, undefined);
      const guard = new RolesGuard(reflector);
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('allows request when user has one of multiple required roles (@Roles("pm", "ba"))', () => {
      const user = { sub: 'test-sub', roles: ['ba'] };
      const { mockContext, reflector } = createMockExecutionContext(user, ['pm', 'ba']);
      const guard = new RolesGuard(reflector);
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('denies request and throws ForbiddenException with correct message', () => {
      const user = { sub: 'test-sub', roles: ['developer'] };
      const { mockContext, reflector } = createMockExecutionContext(user, ['pm']);
      const guard = new RolesGuard(reflector);
      expect(() => guard.canActivate(mockContext)).toThrow('Insufficient role');
    });
  });
});
