# Auth Access Control & Per-Project Roles Design

## Problem

Currently, any user with a valid Keycloak account is auto-provisioned into the app via `upsertFromJwt()`. Roles come from Keycloak `realm_access.roles` (global). The app needs:

1. **DB-gated access** — only users pre-provisioned in the `User` table (by admin via SQL) can use the app
2. **Per-project roles** — roles are assigned per project via `ProjectMember`, not globally
3. **Access denied page** — frontend shows a clear message when a Keycloak-authenticated user isn't in the DB

## Decisions

- **Approach:** Guard-level DB lookup in `JwtStrategy.validate()` (Approach A)
- **Role model:** Two-tier — `SystemRole` (admin/member) on `User`, `ProjectRole` (pm/ba/developer/leadership) on `ProjectMember`
- **User provisioning:** Admin adds users via SQL. No self-registration, no auto-provisioning.
- **Project creation:** Any authenticated `member` can create a project and becomes its PM automatically.

## Schema Changes

### Replace `UserRole` enum with two enums

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

### Update `User.role`

```prisma
model User {
  // ...
  role SystemRole @default(member)
  // ...
}
```

### Update `ProjectMember.role`

```prisma
model ProjectMember {
  // ...
  role ProjectRole
  // ...
}
```

### Delete

- `UserRole` enum (replaced by `SystemRole` + `ProjectRole`)

## Backend Changes

### `auth/jwt.strategy.ts`

- Inject `PrismaService`
- In `validate(payload)`:
  1. Query `User` by `keycloakId = payload.sub`
  2. Not found → `throw new UnauthorizedException('You are not allowed to access the app')`
  3. Found → return the DB `User` object (`id`, `email`, `username`, `role`)
- `req.user` is now the DB user everywhere, not raw JWT claims

### `auth/roles.guard.ts` → `auth/system-roles.guard.ts`

- Rename file and class to `SystemRolesGuard`
- Check `req.user.role` (SystemRole: admin/member)
- Used for system-level endpoints (e.g., user management)

### `auth/roles.decorator.ts` → `auth/system-roles.decorator.ts`

- Rename to `@SystemRoles('admin')` decorator
- Uses `SYSTEM_ROLES_KEY` metadata key

### New: `auth/project-roles.guard.ts`

- `ProjectRolesGuard` implements `CanActivate`
- Extracts `:projectId` from route params
- Queries `ProjectMember` where `userId = req.user.id` AND `projectId`
- Not found → `ForbiddenException('Not a member of this project')`
- Checks `ProjectMember.role` against required roles from `@ProjectRoles()` decorator
- Mismatch → `ForbiddenException('Insufficient project role')`

### New: `auth/project-roles.decorator.ts`

- `@ProjectRoles('pm', 'ba')` decorator
- Uses `PROJECT_ROLES_KEY` metadata key

### `auth/auth.module.ts`

- Import `PrismaModule`
- Register `SystemRolesGuard` and `ProjectRolesGuard`

### `users/users.service.ts`

- Remove `upsertFromJwt()` method
- Remove `mapPrimaryRole()` method
- Keep `findByKeycloakId()` and `findAll()`

### `users/users.controller.ts`

- `GET /users/me` → return `req.user` directly (already the DB user from `validate()`, no extra query needed)
- Update guard usage to `SystemRolesGuard`

### `packages/shared/src/index.ts`

- Replace `UserRole` enum with `SystemRole` and `ProjectRole` enums
- Update `UserProfile` interface to use `SystemRole`
- Add `ProjectMemberProfile` interface with `ProjectRole`
- Update `JwtPayload` (no changes needed — still represents Keycloak token)

### Usage pattern for project-scoped endpoints

```typescript
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
@ProjectRoles('pm')
@Post(':projectId/tasks')
createTask() { ... }
```

### Project creation (no project guard needed)

```typescript
@UseGuards(JwtAuthGuard)
@Post()
createProject() {
  // Any authenticated member can create
  // Service auto-creates ProjectMember with role = 'pm' for creator
}
```

## Frontend Changes

### `auth/AuthProvider.tsx`

- After Keycloak auth succeeds, call `GET /users/me` with the token
- 200 → store DB user in context, proceed
- 401 → set `accessDenied = true`

### `auth/AuthProvider.tsx` — context type update

```typescript
export type AuthContextValue = {
  authenticated: boolean;
  accessDenied: boolean;
  token: string | undefined;
  user: UserProfile | null;  // DB user, replaces roles/username/email
  logout: () => void;
  loading: boolean;
}
```

### `auth/ProtectedRoute.tsx`

- Check `accessDenied` → redirect to `/access-denied`
- Remove `requiredRole` prop (roles are project-scoped now)

### `pages/UnauthorizedPage.tsx` → `pages/AccessDeniedPage.tsx`

- Rename and rework
- Shows centered card with:
  - Heading: "Access Denied"
  - Message: "You are not allowed to access this application. Please contact your administrator."
  - Logout button (to switch accounts or retry)

### `App.tsx`

- Remove role-based routes (`/pm`, `/ba`, `/dev`, `/leadership`)
- Add `/access-denied` route pointing to `AccessDeniedPage`
- All app routes wrapped in `ProtectedRoute` (no `requiredRole` prop)

## Files Summary

| File | Action |
|------|--------|
| `apps/api/prisma/schema.prisma` | Modify — replace `UserRole` with `SystemRole` + `ProjectRole` |
| `packages/shared/src/index.ts` | Modify — update enums and interfaces |
| `apps/api/src/auth/jwt.strategy.ts` | Modify — inject Prisma, DB lookup in validate() |
| `apps/api/src/auth/roles.guard.ts` | Rename → `system-roles.guard.ts`, update class |
| `apps/api/src/auth/roles.decorator.ts` | Rename → `system-roles.decorator.ts`, update |
| `apps/api/src/auth/project-roles.guard.ts` | Create |
| `apps/api/src/auth/project-roles.decorator.ts` | Create |
| `apps/api/src/auth/auth.module.ts` | Modify — add PrismaModule, new guards |
| `apps/api/src/users/users.service.ts` | Modify — remove upsert/mapRole |
| `apps/api/src/users/users.controller.ts` | Modify — simplify /me, update guards |
| `apps/web/src/auth/AuthProvider.tsx` | Modify — add /users/me call, accessDenied state |
| `apps/web/src/auth/ProtectedRoute.tsx` | Modify — check accessDenied, remove requiredRole |
| `apps/web/src/pages/UnauthorizedPage.tsx` | Rename → `AccessDeniedPage.tsx`, rework |
| `apps/web/src/App.tsx` | Modify — remove role routes, add /access-denied |
