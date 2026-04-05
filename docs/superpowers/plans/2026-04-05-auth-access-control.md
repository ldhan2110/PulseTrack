# Auth Access Control & Per-Project Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate app access to admin-provisioned users only, replace global roles with two-tier system (SystemRole on User + ProjectRole on ProjectMember), and show an Access Denied page for unauthorized users.

**Architecture:** JWT validation in `JwtStrategy.validate()` performs a DB lookup — if the user's `keycloakId` isn't in the `User` table, the request is rejected with 401. Roles split into `SystemRole` (admin/member) for system endpoints and `ProjectRole` (pm/ba/developer/leadership) for project-scoped endpoints via `ProjectMember`. Frontend calls `GET /users/me` after Keycloak login and redirects to an Access Denied page on 401.

**Tech Stack:** NestJS 11, Prisma 7, Passport JWT, React 19, Keycloak JS, Vitest

---

### Task 1: Update Prisma Schema — Replace UserRole with SystemRole + ProjectRole

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Replace the UserRole enum with SystemRole and ProjectRole enums**

In `apps/api/prisma/schema.prisma`, replace:

```prisma
enum UserRole {
  pm
  ba
  developer
  leadership
}
```

with:

```prisma
enum SystemRole {
  admin
  member
}

enum ProjectRole {
  pm
  ba
  developer
  leadership
}
```

- [ ] **Step 2: Update User.role to use SystemRole**

In the `User` model, change:

```prisma
  role              UserRole
```

to:

```prisma
  role              SystemRole  @default(member)
```

- [ ] **Step 3: Update ProjectMember.role to use ProjectRole**

In the `ProjectMember` model, change:

```prisma
  role      UserRole
```

to:

```prisma
  role      ProjectRole
```

- [ ] **Step 4: Generate Prisma migration**

Run:
```bash
cd apps/api && npx prisma migrate dev --name replace-userrole-with-system-and-project-roles
```

Expected: Migration created successfully. If the DB has existing data with old enum values, the migration may need a manual SQL step to map `pm`/`ba`/`developer`/`leadership` → `member` in the `User.role` column. For a fresh DB, this runs cleanly.

- [ ] **Step 5: Generate Prisma client**

Run:
```bash
cd apps/api && npx prisma generate
```

Expected: Prisma Client generated successfully. `SystemRole` and `ProjectRole` are now available as TypeScript types from `@prisma/client`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(schema): replace UserRole with SystemRole + ProjectRole enums"
```

---

### Task 2: Update Shared Package — New Enums and Interfaces

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Replace UserRole enum and update interfaces**

Replace the entire contents of `packages/shared/src/index.ts` with:

```typescript
export enum SystemRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum ProjectRole {
  PM = 'pm',
  BA = 'ba',
  DEVELOPER = 'developer',
  LEADERSHIP = 'leadership',
}

export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
}

export enum AiJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum AiJobType {
  STORY_GENERATION = 'STORY_GENERATION',
  TASK_ASSIGNMENT = 'TASK_ASSIGNMENT',
  DAILY_REPORT = 'DAILY_REPORT',
  WEEKLY_REPORT = 'WEEKLY_REPORT',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export interface UserProfile {
  id: string;
  keycloakId: string;
  email: string;
  username: string;
  role: SystemRole;
}

export interface ProjectMemberProfile {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  preferred_username: string;
  realm_access?: { roles: string[] };
}
```

- [ ] **Step 2: Verify the shared package builds**

Run:
```bash
cd packages/shared && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): replace UserRole with SystemRole + ProjectRole, add ProjectMemberProfile"
```

---

### Task 3: Update JwtStrategy — DB Lookup in validate()

**Files:**
- Modify: `apps/api/src/auth/jwt.strategy.ts`
- Modify: `apps/api/src/auth/jwt.strategy.spec.ts`

- [ ] **Step 1: Write failing tests for the new validate() behavior**

Replace the entire contents of `apps/api/src/auth/jwt.strategy.spec.ts` with:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtStrategy as JwtStrategyType } from './jwt.strategy';

vi.mock('@nestjs/passport', () => ({
  PassportStrategy: (_Strategy: any) => {
    return class MockPassportStrategy {
      constructor(_options: any) {}
    };
  },
}));

vi.mock('passport-jwt', () => ({
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: vi.fn(() => vi.fn()),
  },
  Strategy: class MockStrategy {},
}));

vi.mock('jwks-rsa', () => ({
  passportJwtSecret: vi.fn(() => vi.fn()),
}));

import { JwtStrategy } from './jwt.strategy';

function createStrategy(mockUser: any = null): JwtStrategyType {
  const mockConfigService = {
    get: vi.fn((key: string) => {
      if (key === 'KEYCLOAK_URL') return 'http://localhost:8080';
      if (key === 'KEYCLOAK_REALM') return 'test';
      return undefined;
    }),
  } as any;

  const mockPrismaService = {
    user: {
      findUnique: vi.fn().mockResolvedValue(mockUser),
    },
  } as any;

  return new JwtStrategy(mockConfigService, mockPrismaService);
}

describe('JwtStrategy', () => {
  describe('validate()', () => {
    it('returns the DB user when keycloakId exists in User table', async () => {
      const dbUser = {
        id: 'cuid-123',
        keycloakId: 'kc-sub-123',
        email: 'user@example.com',
        username: 'testuser',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const strategy = createStrategy(dbUser);

      const payload = {
        sub: 'kc-sub-123',
        email: 'user@example.com',
        preferred_username: 'testuser',
        realm_access: { roles: ['pm'] },
      };

      const result = await strategy.validate(payload);
      expect(result).toEqual(dbUser);
    });

    it('throws UnauthorizedException when keycloakId is not in User table', async () => {
      const strategy = createStrategy(null);

      const payload = {
        sub: 'unknown-sub',
        email: 'nobody@example.com',
        preferred_username: 'nobody',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow(
        'You are not allowed to access the app',
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd apps/api && npx vitest run src/auth/jwt.strategy.spec.ts
```

Expected: FAIL — `JwtStrategy` constructor doesn't accept `PrismaService` yet, and `validate()` still returns JWT claims.

- [ ] **Step 3: Update jwt.strategy.ts to do DB lookup**

Replace the entire contents of `apps/api/src/auth/jwt.strategy.ts` with:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '@pm/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const keycloakUrl = config.get<string>('KEYCLOAK_URL');
    const realm = config.get<string>('KEYCLOAK_REALM');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
      issuer: `${keycloakUrl}/realms/${realm}`,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { keycloakId: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('You are not allowed to access the app');
    }

    return user;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd apps/api && npx vitest run src/auth/jwt.strategy.spec.ts
```

Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/jwt.strategy.ts apps/api/src/auth/jwt.strategy.spec.ts
git commit -m "feat(auth): gate access via DB lookup in JwtStrategy.validate()"
```

---

### Task 4: Rename RolesGuard → SystemRolesGuard

**Files:**
- Create: `apps/api/src/auth/system-roles.decorator.ts`
- Create: `apps/api/src/auth/system-roles.guard.ts`
- Create: `apps/api/src/auth/system-roles.guard.spec.ts`
- Delete: `apps/api/src/auth/roles.guard.ts`
- Delete: `apps/api/src/auth/roles.guard.spec.ts`
- Delete: `apps/api/src/auth/roles.decorator.ts`

- [ ] **Step 1: Create system-roles.decorator.ts**

Create `apps/api/src/auth/system-roles.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const SYSTEM_ROLES_KEY = 'systemRoles';
export const SystemRoles = (...roles: string[]) => SetMetadata(SYSTEM_ROLES_KEY, roles);
```

- [ ] **Step 2: Create system-roles.guard.ts**

Create `apps/api/src/auth/system-roles.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SYSTEM_ROLES_KEY } from './system-roles.decorator';

@Injectable()
export class SystemRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(SYSTEM_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const hasRole = requiredRoles.some((role) => role === user?.role);
    if (!hasRole) throw new ForbiddenException('Insufficient system role');
    return true;
  }
}
```

- [ ] **Step 3: Create system-roles.guard.spec.ts**

Create `apps/api/src/auth/system-roles.guard.spec.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd apps/api && npx vitest run src/auth/system-roles.guard.spec.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Delete old roles files**

```bash
rm apps/api/src/auth/roles.guard.ts apps/api/src/auth/roles.guard.spec.ts apps/api/src/auth/roles.decorator.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/system-roles.decorator.ts apps/api/src/auth/system-roles.guard.ts apps/api/src/auth/system-roles.guard.spec.ts
git add apps/api/src/auth/roles.guard.ts apps/api/src/auth/roles.guard.spec.ts apps/api/src/auth/roles.decorator.ts
git commit -m "feat(auth): replace RolesGuard with SystemRolesGuard for system-level RBAC"
```

---

### Task 5: Create ProjectRolesGuard

**Files:**
- Create: `apps/api/src/auth/project-roles.decorator.ts`
- Create: `apps/api/src/auth/project-roles.guard.ts`
- Create: `apps/api/src/auth/project-roles.guard.spec.ts`

- [ ] **Step 1: Create project-roles.decorator.ts**

Create `apps/api/src/auth/project-roles.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const PROJECT_ROLES_KEY = 'projectRoles';
export const ProjectRoles = (...roles: string[]) => SetMetadata(PROJECT_ROLES_KEY, roles);
```

- [ ] **Step 2: Write failing tests for ProjectRolesGuard**

Create `apps/api/src/auth/project-roles.guard.spec.ts`:

```typescript
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
cd apps/api && npx vitest run src/auth/project-roles.guard.spec.ts
```

Expected: FAIL — `ProjectRolesGuard` doesn't exist yet.

- [ ] **Step 4: Implement ProjectRolesGuard**

Create `apps/api/src/auth/project-roles.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PROJECT_ROLES_KEY } from './project-roles.decorator';

@Injectable()
export class ProjectRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const projectId = request.params.projectId;

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this project');
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(PROJECT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const hasRole = requiredRoles.some((role) => role === member.role);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient project role');
    }

    return true;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
cd apps/api && npx vitest run src/auth/project-roles.guard.spec.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/project-roles.decorator.ts apps/api/src/auth/project-roles.guard.ts apps/api/src/auth/project-roles.guard.spec.ts
git commit -m "feat(auth): add ProjectRolesGuard for per-project RBAC"
```

---

### Task 6: Update AuthModule

**Files:**
- Modify: `apps/api/src/auth/auth.module.ts`

- [ ] **Step 1: Update auth.module.ts to register new guards**

Replace the entire contents of `apps/api/src/auth/auth.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { SystemRolesGuard } from './system-roles.guard';
import { ProjectRolesGuard } from './project-roles.guard';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
  ],
  providers: [JwtStrategy, SystemRolesGuard, ProjectRolesGuard],
  exports: [PassportModule, SystemRolesGuard, ProjectRolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 2: Verify the API compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors. `PrismaService` is injected into `JwtStrategy` via the global `PrismaModule`, so no explicit import needed in `AuthModule`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/auth/auth.module.ts
git commit -m "feat(auth): register SystemRolesGuard and ProjectRolesGuard in AuthModule"
```

---

### Task 7: Update UsersService and UsersController

**Files:**
- Modify: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/users/users.controller.ts`

- [ ] **Step 1: Remove auto-provisioning from UsersService**

Replace the entire contents of `apps/api/src/users/users.service.ts` with:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByKeycloakId(keycloakId: string) {
    return this.prisma.user.findUnique({ where: { keycloakId } });
  }

  async findAll() {
    return this.prisma.user.findMany();
  }
}
```

- [ ] **Step 2: Update UsersController — simplify /me, update guards**

Replace the entire contents of `apps/api/src/users/users.controller.ts` with:

```typescript
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemRolesGuard } from '../auth/system-roles.guard';
import { SystemRoles } from '../auth/system-roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@Req() req: any) {
    // req.user is already the DB user from JwtStrategy.validate()
    return req.user;
  }

  @Get()
  @UseGuards(SystemRolesGuard)
  @SystemRoles('admin')
  async findAll() {
    return this.usersService.findAll();
  }
}
```

- [ ] **Step 3: Verify API compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run all API tests**

Run:
```bash
cd apps/api && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/users/users.service.ts apps/api/src/users/users.controller.ts
git commit -m "feat(users): remove auto-provisioning, simplify /me endpoint, use SystemRolesGuard"
```

---

### Task 8: Frontend — Update AuthProvider with DB User Verification

**Files:**
- Modify: `apps/web/src/auth/AuthProvider.tsx`
- Modify: `apps/web/src/auth/useAuth.ts`

- [ ] **Step 1: Update AuthProvider to call /users/me and handle 401**

Replace the entire contents of `apps/web/src/auth/AuthProvider.tsx` with:

```typescript
import React, { createContext, useEffect, useState, useCallback } from 'react';
import keycloak from './keycloak';
import type { UserProfile } from '@pm/shared';

export type AuthContextValue = {
  authenticated: boolean;
  accessDenied: boolean;
  token: string | undefined;
  user: UserProfile | null;
  logout: () => void;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

let initialized = false;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialized) return;
    initialized = true;

    keycloak
      .init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        checkLoginIframe: false,
      })
      .then(async (auth) => {
        if (!auth) {
          setAuthenticated(false);
          setLoading(false);
          return;
        }

        setAuthenticated(true);

        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
          const response = await fetch(`${apiUrl}/users/me`, {
            headers: { Authorization: `Bearer ${keycloak.token}` },
          });

          if (response.ok) {
            const profile: UserProfile = await response.json();
            setUser(profile);
          } else if (response.status === 401) {
            setAccessDenied(true);
          } else {
            setAccessDenied(true);
          }
        } catch {
          setAccessDenied(true);
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error('Keycloak init failed:', err);
        setLoading(false);
      });

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => keycloak.logout());
    };
  }, []);

  const logout = useCallback(() => {
    keycloak.logout({ redirectUri: window.location.origin });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        accessDenied,
        token: keycloak.token,
        user,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Update useAuth hook (no changes needed, types flow from AuthContextValue)**

The `useAuth.ts` file doesn't need changes — the `AuthContextValue` type update flows automatically.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/auth/AuthProvider.tsx
git commit -m "feat(auth-ui): verify user against DB on login, set accessDenied on 401"
```

---

### Task 9: Frontend — Access Denied Page + Route Updates

**Files:**
- Create: `apps/web/src/pages/AccessDeniedPage.tsx`
- Delete: `apps/web/src/pages/UnauthorizedPage.tsx`
- Modify: `apps/web/src/auth/ProtectedRoute.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create AccessDeniedPage**

Create `apps/web/src/pages/AccessDeniedPage.tsx`:

```tsx
import { useAuth } from '../auth/useAuth';

export function AccessDeniedPage() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-5xl">🚫</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="mb-6 text-gray-600">
          You are not allowed to access this application. Please contact your administrator.
        </p>
        <button
          onClick={logout}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete UnauthorizedPage**

```bash
rm apps/web/src/pages/UnauthorizedPage.tsx
```

- [ ] **Step 3: Update ProtectedRoute — check accessDenied, remove requiredRole**

Replace the entire contents of `apps/web/src/auth/ProtectedRoute.tsx` with:

```tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import keycloak from './keycloak';

interface Props {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { authenticated, accessDenied, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!authenticated) {
    keycloak.login();
    return <div>Redirecting to login...</div>;
  }

  if (accessDenied) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Update App.tsx — remove role routes, add /access-denied**

Replace the entire contents of `apps/web/src/App.tsx` with:

```tsx
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';

function App() {
  return (
    <Routes>
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
```

- [ ] **Step 5: Update DashboardPage to use new context shape**

Replace the entire contents of `apps/web/src/pages/DashboardPage.tsx` with:

```tsx
import { useAuth } from '../auth/useAuth';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>PM App - Dashboard</h1>
      <div>
        <p>
          <strong>User:</strong> {user?.username}
        </p>
        <p>
          <strong>Email:</strong> {user?.email}
        </p>
        <p>
          <strong>System Role:</strong> {user?.role}
        </p>
      </div>
      <button onClick={logout} style={{ marginTop: '1rem' }}>
        Logout
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Verify frontend compiles**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/AccessDeniedPage.tsx apps/web/src/auth/ProtectedRoute.tsx apps/web/src/App.tsx apps/web/src/pages/DashboardPage.tsx
git add apps/web/src/pages/UnauthorizedPage.tsx
git commit -m "feat(ui): add Access Denied page, remove role-based routes, update dashboard"
```

---

### Task 10: Update Frontend Auth Test

**Files:**
- Modify: `apps/web/src/auth/AuthProvider.test.tsx`

- [ ] **Step 1: Read current test to understand what needs updating**

The existing test references the old context shape (`roles`, `username`, `email`). Update it to match the new shape (`user`, `accessDenied`).

- [ ] **Step 2: Update the test**

Replace the entire contents of `apps/web/src/auth/AuthProvider.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, AuthContext } from './AuthProvider';
import { useContext } from 'react';

// Mock keycloak-js
const mockKeycloak = {
  init: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  token: 'mock-token',
  tokenParsed: null,
  onTokenExpired: null as (() => void) | null,
  updateToken: vi.fn(),
};

vi.mock('./keycloak', () => ({ default: mockKeycloak }));

// Mock fetch for /users/me
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function TestConsumer() {
  const ctx = useContext(AuthContext);
  if (!ctx) return <div>no context</div>;
  return (
    <div>
      <span data-testid="authenticated">{String(ctx.authenticated)}</span>
      <span data-testid="accessDenied">{String(ctx.accessDenied)}</span>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="username">{ctx.user?.username ?? 'none'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the initialized flag by re-importing (handled by vitest module isolation)
  });

  it('sets accessDenied=true when /users/me returns 401', async () => {
    mockKeycloak.init.mockResolvedValue(true);
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('accessDenied').textContent).toBe('true');
    expect(screen.getByTestId('username').textContent).toBe('none');
  });
});
```

- [ ] **Step 3: Run test**

Run:
```bash
cd apps/web && npx vitest run src/auth/AuthProvider.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/auth/AuthProvider.test.tsx
git commit -m "test(auth-ui): update AuthProvider test for accessDenied flow"
```
