# Phase 1: Infrastructure Baseline - Research

**Researched:** 2026-04-05
**Domain:** Monorepo scaffolding, Keycloak SSO authentication, NestJS RBAC, Prisma schema, Docker Compose dev environment, BullMQ/Redis queue infrastructure
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Monorepo with pnpm workspaces — single repository containing `apps/web` (React/Vite frontend) and `apps/api` (NestJS backend), with a shared `packages/shared` for TypeScript types used by both. pnpm is the standard workspace tool for NestJS + React monorepos.
- **D-02:** Full database schema defined upfront in Phase 1 via Prisma. All tables for all 7 phases (users, projects, tasks, sprints, comments, time_logs, ai_jobs, blueprint_sync, reports, etc.) are created now. Later phases add business logic and data — not new tables. This prevents foreign key surprises and migration conflicts as phases build on each other.
- **D-03:** Use `keycloak-js` adapter for the frontend (public client, Authorization Code Flow with PKCE). keycloak-js is still supported for browser-side use per CLAUDE.md stack spec. Backend validates Bearer JWTs using `openid-client` v6 + `passport-jwt` as specified.
- **D-04:** Auth state managed via a React context provider wrapping the app. Token refresh handled automatically by keycloak-js. Authenticated routes use a ProtectedRoute wrapper component.
- **D-05:** NestJS custom `@Roles()` decorator + `RolesGuard` pattern. Guard extracts roles from `realm_access.roles` in the JWT claims and checks against the decorator's required roles. Unauthenticated requests get 401; authenticated but unauthorized requests get 403.
- **D-06:** Four roles: `pm`, `ba`, `developer`, `leadership`. Roles are managed in Keycloak (realm roles), not in the PM database. The PM database stores user profiles synced from Keycloak tokens on first login.

### Claude's Discretion

- Specific pnpm workspace configuration and package naming conventions
- Prisma schema field-level details (field types, constraints, indexes) — follow best practices
- Docker Compose service naming and networking configuration
- ESLint/Prettier configuration details
- NestJS module organization within the API app

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in via Keycloak SSO using company credentials | keycloak-js v26 Authorization Code + PKCE flow on frontend; openid-client v6 + passport-jwt on backend validates the issued Bearer JWT |
| AUTH-02 | User session persists across browser refresh (JWT token refresh) | keycloak-js automatic token refresh via `updateTokenMinValidity`; silent-check-sso pattern with dedicated HTML page avoids full redirect on refresh |
| AUTH-03 | User can log out from any page | `keycloak.logout()` with `redirectUri` back to Keycloak login page; invalidates the Keycloak session |
| RBAC-01 | PM role can create/manage projects, approve AI outputs, view all project data | `@Roles('pm')` decorator on NestJS controller methods; `RolesGuard` reads `realm_access.roles` from validated JWT |
| RBAC-02 | BA role can create feature descriptions, review/edit AI-generated stories, manage acceptance criteria | `@Roles('ba')` on relevant endpoints; same guard infrastructure |
| RBAC-03 | Developer role can view assigned tasks, log time, update task status, add comments | `@Roles('developer')` on relevant endpoints |
| RBAC-04 | Leadership role can view cross-project dashboards and reports (read-only) | `@Roles('leadership')` on read-only endpoints; guard returns 403 on write attempts |
</phase_requirements>

---

## Summary

Phase 1 establishes the full technical foundation for the PM application: monorepo scaffolding, Keycloak SSO authentication on both frontend and backend, NestJS RBAC enforcement, the complete Prisma database schema for all 7 phases, BullMQ/Redis queue infrastructure, and a Docker Compose dev environment that starts everything with one command.

The frontend uses `keycloak-js` v26 for browser-side OIDC Authorization Code + PKCE flow. The backend uses `openid-client` v6 + `passport-jwt` to validate Keycloak-issued JWTs on every request. RBAC is implemented via a custom `@Roles()` decorator and `RolesGuard` that extracts roles from `realm_access.roles` in the JWT payload. The Prisma schema defines all tables upfront to prevent foreign key surprises in later phases.

The primary pitfall in this phase is double initialization of `keycloak-js` under React 18 StrictMode, which causes infinite redirect loops. The solution is to initialize Keycloak outside React's render tree using a module-scoped singleton. Docker Compose startup ordering (Redis before NestJS, PostgreSQL before NestJS) must use health checks with `condition: service_healthy` — not just `depends_on` — because `depends_on` alone only waits for container start, not service readiness.

**Primary recommendation:** Use `keycloak-js` module-singleton pattern (initialize once outside React component tree), `passport-jwt` with `jwks-rsa` for JWKS-based JWT validation, and Docker Compose health checks for all infrastructure services before starting the NestJS API.

---

## Standard Stack

### Core (verified via npm registry 2026-04-05)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| keycloak-js | 26.2.3 | Frontend OIDC Authorization Code + PKCE flow | Official Keycloak JS adapter; still maintained for browser/public clients. Handles token storage, silent SSO, and automatic refresh. |
| openid-client | 6.8.2 | Backend JWT validation via OIDC discovery | OIDC-certified; officially recommended Keycloak replacement for deprecated `keycloak-connect`. Fetches JWKS automatically from Keycloak's discovery endpoint. |
| @nestjs/passport | 11.0.5 | NestJS Passport integration | First-class NestJS module; DI-injectable strategies, guard decorators, and `@UseGuards(AuthGuard('jwt'))` pattern. |
| passport-jwt | 4.0.1 | Passport JWT strategy for Bearer token extraction | Standard Passport strategy; extracts Bearer token from Authorization header and passes to `validate()`. |
| jwks-rsa | 4.0.1 | JWKS URI key fetching for RS256 JWT verification | Used as `secretOrKeyProvider` in passport-jwt config; fetches Keycloak's public keys from JWKS URI with caching. |
| @nestjs/jwt | 11.0.2 | JWT utilities in NestJS | Complements passport-jwt with DI integration. |
| prisma | 7.6.0 | ORM + migrations | Schema-first; type-safe client generated from schema. `prisma migrate dev` for dev, `prisma migrate deploy` for production. |
| @prisma/client | 7.6.0 | Generated Prisma client | Auto-generated from schema; use in NestJS services via DI. |
| bullmq | 5.73.0 | Job queue backed by Redis | Requires Redis 7+. Full TypeScript support. Active maintenance. |
| @nestjs/bullmq | 11.0.4 | BullMQ NestJS module | DI-injectable producers and `@Processor`-decorated worker classes. |
| @nestjs/config | 4.0.3 | Environment variable management | Loads `.env` files; provides `ConfigService` injectable for all config values. Required before configuring auth, DB, Redis. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-validator | 0.15.1 | NestJS DTO validation | Required for `ValidationPipe` to validate incoming request bodies. |
| class-transformer | 0.5.1 | DTO serialization | Required alongside class-validator; transforms plain objects to class instances. |
| @nestjs/swagger | 11.2.6 | OpenAPI spec generation | Mount at `/api/docs`; needed from Phase 1 for Blueprint integration planning. |
| nestjs-pino | 4.6.1 | Structured JSON logging | Use for request logs and job lifecycle events. |
| @nestjs/schedule | 6.1.1 | Cron scheduling | Included in Phase 1 setup; used in Phase 6 for Blueprint sync and report generation. |
| @nestjs/platform-socket.io | 11.1.18 | Socket.IO NestJS adapter | Included in Phase 1 setup; WebSocket gateways used starting Phase 4. |
| socket.io | 4.8.3 | Real-time push | Initialize in Phase 1 setup; activate in Phase 4. |
| @tanstack/react-query | 5.96.2 | Frontend server-state management | Install in Phase 1; used for all API calls from Phase 2 onwards. |
| zustand | 5.0.12 | Frontend client-state management | Install in Phase 1; used for UI state from Phase 2 onwards. |
| tailwindcss | 4.2.2 | Utility-first CSS | Configure in Phase 1 with shadcn/ui init. |
| axios | latest (1.x) | HTTP client for Blueprint sync | Backend-only; NestJS `BlueprintModule` for Phase 6. Include in Phase 1 deps setup. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| openid-client v6 | keycloak-connect | NEVER: `keycloak-connect` officially deprecated by Keycloak 2022 |
| passport-jwt + jwks-rsa | openid-client's built-in JWT verification | openid-client v6 changed API significantly; passport-jwt is more battle-tested in NestJS context |
| pnpm workspaces | Nx | Nx adds more tooling complexity; pnpm native workspaces are sufficient for a 2-app monorepo |
| Custom RolesGuard | nest-keycloak-connect library | `nest-keycloak-connect` wraps deprecated adapter internally; custom guard is cleaner and explicit |

**Installation (Phase 1 full dependency set):**

```bash
# Install pnpm globally (not present in current environment)
npm install -g pnpm@10

# Initialize monorepo
mkdir pm-app && cd pm-app
pnpm init

# Create workspace structure
mkdir -p apps/api apps/web packages/shared

# Backend
cd apps/api
npx @nestjs/cli new . --skip-git --package-manager pnpm
pnpm add @nestjs/passport @nestjs/jwt @nestjs/config @nestjs/bullmq @nestjs/swagger @nestjs/schedule @nestjs/platform-socket.io
pnpm add passport passport-jwt jwks-rsa openid-client
pnpm add prisma @prisma/client bullmq socket.io axios class-validator class-transformer nestjs-pino
pnpm add -D @types/passport-jwt vitest

# Frontend
cd ../web
pnpm create vite . --template react-ts
pnpm add keycloak-js @tanstack/react-query zustand tailwindcss
pnpm add -D @types/node

# Shared types package
cd ../../packages/shared
pnpm init
```

**Version verification (npm registry 2026-04-05, HIGH confidence):**
- keycloak-js: 26.2.3 (published 2026-02-04)
- openid-client: 6.8.2
- @nestjs/passport: 11.0.5 (published 2025-01-23)
- passport-jwt: 4.0.1 (published 2025-01-10)
- jwks-rsa: 4.0.1
- bullmq: 5.73.0
- @nestjs/bullmq: 11.0.4
- prisma: 7.6.0
- @nestjs/config: 4.0.3
- pnpm: 10.33.0 (current version)

---

## Architecture Patterns

### Recommended Project Structure

```
pm-app/                          # Monorepo root
├── apps/
│   ├── api/                     # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/            # JWT strategy, guards, decorators
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── roles.decorator.ts
│   │   │   ├── users/           # User profile sync from Keycloak JWT
│   │   │   │   ├── users.module.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   └── users.controller.ts
│   │   │   ├── prisma/          # PrismaService (DI wrapper)
│   │   │   │   └── prisma.service.ts
│   │   │   ├── queue/           # BullMQ setup
│   │   │   │   └── queue.module.ts
│   │   │   └── app.module.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # Full schema (all 7 phases)
│   │   │   └── migrations/
│   │   ├── .env
│   │   └── package.json
│   └── web/                     # React/Vite frontend
│       ├── src/
│       │   ├── auth/
│       │   │   ├── keycloak.ts           # Singleton init
│       │   │   ├── AuthProvider.tsx       # React context
│       │   │   └── ProtectedRoute.tsx
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── public/
│       │   └── silent-check-sso.html     # Required for silent SSO
│       ├── vite.config.ts
│       └── package.json
├── packages/
│   └── shared/                  # Shared TypeScript types
│       ├── src/
│       │   └── index.ts         # Exported types (UserRole, etc.)
│       └── package.json
├── pnpm-workspace.yaml
├── docker-compose.yml
├── docker-compose.override.yml  # Dev overrides (volumes, ports)
├── .env.example
└── package.json                 # Root scripts
```

### Pattern 1: keycloak-js Module Singleton (CRITICAL)

**What:** Initialize Keycloak exactly once in a module-scope variable, never inside a React component or effect.
**When to use:** Always — React 18 StrictMode double-invokes effects, which triggers `keycloak.init()` twice and causes "A 'Keycloak' instance can only be initialized once" error and infinite redirect loops.

```typescript
// Source: keycloak/keycloak-js issues #19452, #12745 — confirmed pattern
// apps/web/src/auth/keycloak.ts
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,       // e.g. https://keycloak.company.com
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

export default keycloak;
```

```typescript
// apps/web/src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import keycloak from './keycloak';

interface AuthContextValue {
  authenticated: boolean;
  token: string | undefined;
  roles: string[];
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let initialized = false; // module-level guard

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialized) return;
    initialized = true;

    keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      checkLoginIframe: false, // Avoids iframe issues in strict CSP environments
    }).then((auth) => {
      setAuthenticated(auth);
      setLoading(false);
    });

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => keycloak.logout());
    };
  }, []);

  if (loading) return <div>Loading...</div>;

  const roles = keycloak.tokenParsed?.realm_access?.roles ?? [];

  return (
    <AuthContext.Provider value={{
      authenticated,
      token: keycloak.token,
      roles,
      logout: () => keycloak.logout({ redirectUri: window.location.origin }),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```

```html
<!-- apps/web/public/silent-check-sso.html — required for silent SSO -->
<!doctype html>
<html>
  <body>
    <script>parent.postMessage(location.href, location.origin);</script>
  </body>
</html>
```

### Pattern 2: NestJS JWT Strategy with JWKS (Keycloak public key fetching)

**What:** Passport JWT strategy that validates Keycloak-issued RS256 JWTs using the JWKS URI from Keycloak's OIDC discovery endpoint. No hardcoded secrets — keys rotate automatically.
**When to use:** Every NestJS backend that validates Keycloak JWTs.

```typescript
// Source: NestJS docs + Keycloak JWT auth guide + multiple verified sources (2025-2026)
// apps/api/src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  preferred_username: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private config: ConfigService) {
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
    return {
      sub: payload.sub,
      email: payload.email,
      username: payload.preferred_username,
      roles: payload.realm_access?.roles ?? [],
    };
  }
}
```

### Pattern 3: Custom @Roles Decorator + RolesGuard

**What:** `@Roles()` decorator attaches required roles as metadata; `RolesGuard` reads metadata via `Reflector` and compares against user roles from the validated JWT.
**When to use:** Apply `@UseGuards(JwtAuthGuard, RolesGuard)` globally or per-controller; use `@Roles()` on individual endpoints.

```typescript
// apps/api/src/auth/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// apps/api/src/auth/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const hasRole = requiredRoles.some((role) => user?.roles?.includes(role));
    if (!hasRole) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
```

```typescript
// apps/api/src/auth/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

```typescript
// Usage on a controller
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  @Post()
  @Roles('pm')
  create() { /* PM only */ }

  @Get()
  @Roles('pm', 'ba', 'developer', 'leadership')
  findAll() { /* all authenticated roles */ }
}
```

### Pattern 4: pnpm Workspace Configuration

**What:** Single `pnpm-workspace.yaml` at root defines workspace packages. Shared types package linked via `workspace:*` protocol.

```yaml
# pnpm-workspace.yaml (root)
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// packages/shared/package.json
{
  "name": "@pm/shared",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

```json
// apps/api/package.json (relevant excerpt)
{
  "dependencies": {
    "@pm/shared": "workspace:*"
  }
}
```

```json
// Root package.json scripts
{
  "scripts": {
    "dev:api": "pnpm --filter @pm/api dev",
    "dev:web": "pnpm --filter @pm/web dev",
    "migrate": "pnpm --filter @pm/api exec prisma migrate dev",
    "build": "pnpm -r build"
  }
}
```

### Pattern 5: Docker Compose with Health Checks

**What:** Services that depend on PostgreSQL or Redis must wait for them to be healthy, not just started.
**When to use:** Always — Docker Compose `depends_on` alone does not wait for service readiness.

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: pm
      POSTGRES_PASSWORD: pm_dev
      POSTGRES_DB: pm_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pm -d pm_dev"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://pm:pm_dev@postgres:5432/pm_dev
      REDIS_URL: redis://redis:6379
    volumes:
      - ./apps/api:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: pnpm run start:dev

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - ./apps/web:/app
      - /app/node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true   # Required for HMR in Docker on macOS/Windows
    command: pnpm run dev

volumes:
  postgres_data:
```

### Pattern 6: Vite Docker HMR Configuration

**What:** Vite dev server must be configured to listen on `0.0.0.0` and expose the correct HMR port when running inside Docker.

```typescript
// apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,  // Must match the exposed port
    },
    watch: {
      usePolling: true,  // Required for file change detection in Docker
    },
  },
});
```

### Anti-Patterns to Avoid

- **Calling `keycloak.init()` inside a `useEffect`:** React 18 StrictMode calls effects twice in dev mode; use module-level `initialized` boolean guard.
- **Using `depends_on` without `condition: service_healthy`:** NestJS will fail to connect to PostgreSQL/Redis if they haven't finished initializing.
- **Hardcoding Keycloak public keys:** Use `jwks-rsa` with JWKS URI — Keycloak rotates signing keys.
- **Using `keycloak-connect` or `nest-keycloak-connect` on the backend:** Deprecated; wraps the deprecated adapter.
- **Storing roles in the PM database:** Roles live in Keycloak realm roles only; PM DB stores user profiles, not authorization data.
- **Running `prisma migrate dev` in production:** Use `prisma migrate deploy` only.
- **Defining the full schema across multiple migration files in separate phases:** D-02 requires the full schema in one Phase 1 migration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keycloak JWT public key fetching | Custom JWKS HTTP client | `jwks-rsa` | Handles key caching, rate limiting, key rotation, and RS256 algorithm lookup automatically |
| Token extraction from Authorization header | Manual header parsing | `ExtractJwt.fromAuthHeaderAsBearerToken()` from passport-jwt | Handles Bearer prefix, missing header, malformed tokens |
| Silent SSO iframe communication | Custom postMessage handler | `keycloak-js` silentCheckSso + dedicated HTML page | Keycloak's protocol is non-trivial; the library implements it correctly |
| OIDC discovery / JWKS URI lookup | Manual HTTP fetch to `.well-known/openid-configuration` | `openid-client` Issuer.discover() | Handles all OIDC metadata, JWKS caching, and error cases |
| Guard metadata reflection | Custom metadata storage | `@SetMetadata` + NestJS `Reflector` | NestJS DI tree handles metadata propagation; manual approaches break with inheritance |
| Docker service startup ordering | Sleep loops in entrypoint scripts | Docker Compose `healthcheck` + `condition: service_healthy` | Sleep loops are fragile; health checks use actual service probes |

**Key insight:** The auth stack (keycloak-js + openid-client + passport-jwt + jwks-rsa) is four libraries that each solve one piece of a complex protocol. Any custom implementation will miss edge cases in PKCE, key rotation, token refresh races, and OIDC discovery.

---

## Common Pitfalls

### Pitfall 1: keycloak-js Double Initialization (React StrictMode)
**What goes wrong:** `keycloak.init()` is called twice in development due to React 18's StrictMode double-effect invocation. Keycloak throws "A 'Keycloak' instance can only be initialized once" or enters an infinite redirect loop between the app and Keycloak login page.
**Why it happens:** StrictMode intentionally double-invokes effects to detect side effects. `keycloak.init()` modifies global browser state (URL, cookies, session storage) and cannot be called twice.
**How to avoid:** Initialize the `Keycloak` instance at module scope (not inside a component). Use a module-level `initialized` boolean guard in the `useEffect` to ensure init runs once even if the effect fires twice.
**Warning signs:** Infinite browser redirects in dev mode; login page loop that breaks when StrictMode is removed.

### Pitfall 2: silent-check-sso.html Missing
**What goes wrong:** `keycloak.init()` with `onLoad: 'check-sso'` opens a hidden iframe to check if the user already has a Keycloak session. If the HTML file is missing, the iframe fails silently, and the app falls back to a full-page redirect on every load — effectively breaking session persistence (AUTH-02).
**Why it happens:** The file must be served from the same origin as the app. It is not created automatically by keycloak-js.
**How to avoid:** Create `apps/web/public/silent-check-sso.html` with a `postMessage` back to the parent. Vite serves `public/` at the root automatically.
**Warning signs:** AUTH-02 fails; browser refreshes always redirect to Keycloak login.

### Pitfall 3: Docker depends_on Without Health Check
**What goes wrong:** NestJS API starts before PostgreSQL or Redis is ready to accept connections. Prisma migration fails, BullMQ throws connection errors, and the container exits. Docker Compose reports the stack is "up" but the API is actually crashed.
**Why it happens:** `depends_on` without `condition: service_healthy` only waits for the container to start, not for the service inside to be ready.
**How to avoid:** Add `healthcheck` to the postgres and redis services. Use `condition: service_healthy` in the api's `depends_on` block.
**Warning signs:** NestJS container exits immediately on first `docker-compose up` but works on second run (after services are warm).

### Pitfall 4: Full Schema Migration in Phase 1 Contains Forward References
**What goes wrong:** The Phase 1 Prisma schema references tables from later phases (e.g., `ai_jobs`, `blueprint_sync`) that have complex relational dependencies. If foreign keys are defined incorrectly, `prisma migrate dev` will fail with constraint errors.
**Why it happens:** Defining all tables upfront (D-02) is correct, but the migration must be self-consistent — all referenced tables must exist in the same migration.
**How to avoid:** Define all models in a single `schema.prisma` file. Run `prisma migrate dev --name init` once to generate a single baseline migration. All foreign keys will resolve because all tables are created together.
**Warning signs:** `prisma migrate dev` error mentioning foreign key constraint violations or undefined table references.

### Pitfall 5: keycloak-js v26 API Changes from Earlier Versions
**What goes wrong:** Documentation examples for keycloak-js v17-v21 (common in tutorials) use different import styles and configuration options that are removed or renamed in v26.
**Why it happens:** keycloak-js changed its package exports in v19+ (ESM-only, named exports). Many tutorials are outdated.
**How to avoid:** Use `import Keycloak from 'keycloak-js'` (default import). Do not use `new Keycloak.default()`. Verify behavior against the official Keycloak docs for the specific version installed.
**Warning signs:** `Keycloak is not a constructor` or `cannot find module 'keycloak-js/dist/keycloak'` errors.

### Pitfall 6: JWKS Cache Miss Under Load (False Positive 401s)
**What goes wrong:** If `jwks-rsa` cannot fetch the JWKS URI (Keycloak unreachable at startup), the strategy caches an empty key set. All subsequent JWT verifications fail with 401 until the cache TTL expires.
**Why it happens:** `jwks-rsa` defaults to caching. If the first request fails, the failure may be cached.
**How to avoid:** Set `cache: true, rateLimit: true, jwksRequestsPerMinute: 5`. Ensure Keycloak is reachable from the NestJS container at startup (add Keycloak URL to Docker Compose if self-hosted, or verify network connectivity to company Keycloak).
**Warning signs:** All requests return 401 immediately after startup even with valid tokens.

### Pitfall 7: Vite HMR Not Working in Docker
**What goes wrong:** Code changes in `apps/web/src/` do not trigger hot reload when the Vite dev server runs inside a Docker container on macOS or Windows.
**Why it happens:** Docker Desktop on macOS/Windows uses a VM layer that breaks inotify-based file watching. Vite uses inotify by default.
**How to avoid:** Set `CHOKIDAR_USEPOLLING=true` environment variable on the web container AND configure `server.watch.usePolling: true` in `vite.config.ts`.
**Warning signs:** File changes require manual browser refresh in dev mode.

---

## Code Examples

### Prisma Schema (Phase 1 Full Baseline)

```prisma
// Source: Prisma official docs (one-to-many relations, enums, JSONB) — HIGH confidence
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =====================
// ENUMS
// =====================

enum UserRole {
  pm
  ba
  developer
  leadership
}

enum TaskStatus {
  BACKLOG
  IN_PROGRESS
  IN_REVIEW
  DONE
  BLOCKED
}

enum AiJobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum AiJobType {
  STORY_GENERATION
  TASK_ASSIGNMENT
  DAILY_REPORT
  WEEKLY_REPORT
}

enum SyncStatus {
  PENDING
  SYNCED
  FAILED
}

// =====================
// CORE MODELS
// =====================

model User {
  id                String    @id @default(cuid())
  keycloakId        String    @unique // sub from JWT
  email             String    @unique
  username          String
  role              UserRole
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  ownedProjects     Project[] @relation("ProjectOwner")
  projectMembers    ProjectMember[]
  assignedTasks     Task[]    @relation("TaskAssignee")
  createdTasks      Task[]    @relation("TaskCreator")
  comments          Comment[]
  timeLogs          TimeLog[]
  aiJobsRequested   AiJob[]
}

model Project {
  id          String    @id @default(cuid())
  name        String
  description String?
  archived    Boolean   @default(false)
  ownerId     String
  owner       User      @relation("ProjectOwner", fields: [ownerId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  members     ProjectMember[]
  sprints     Sprint[]
  tasks       Task[]
  aiJobs      AiJob[]
  reports     Report[]
  blueprintSyncs BlueprintSync[]
}

model ProjectMember {
  id        String    @id @default(cuid())
  projectId String
  userId    String
  role      UserRole
  joinedAt  DateTime  @default(now())

  project   Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
}

model Sprint {
  id          String    @id @default(cuid())
  name        String
  projectId   String
  startDate   DateTime
  endDate     DateTime
  createdAt   DateTime  @default(now())

  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks       Task[]
}

model Task {
  id                  String      @id @default(cuid())
  title               String
  description         String?
  status              TaskStatus  @default(BACKLOG)
  storyPoints         Int?
  acceptanceCriteria  String?
  isDraft             Boolean     @default(false) // AI-generated pending approval
  blueprintId         String?     // External Blueprint task ID
  projectId           String
  sprintId            String?
  assigneeId          String?
  creatorId           String
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sprint      Sprint?   @relation(fields: [sprintId], references: [id])
  assignee    User?     @relation("TaskAssignee", fields: [assigneeId], references: [id])
  creator     User      @relation("TaskCreator", fields: [creatorId], references: [id])
  comments    Comment[]
  timeLogs    TimeLog[]
  blueprintSyncs BlueprintSync[]
}

model Comment {
  id        String    @id @default(cuid())
  content   String
  taskId    String
  authorId  String
  parentId  String?   // Threaded comments
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  task      Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  author    User      @relation(fields: [authorId], references: [id])
  parent    Comment?  @relation("CommentThread", fields: [parentId], references: [id])
  replies   Comment[] @relation("CommentThread")
}

model TimeLog {
  id          String    @id @default(cuid())
  minutes     Int       // Duration in minutes
  loggedAt    DateTime  @default(now())
  taskId      String
  userId      String
  blueprintId String?   // Blueprint time log ID after sync

  task        Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id])
}

// =====================
// AI INFRASTRUCTURE
// =====================

model AiJob {
  id          String      @id @default(cuid())
  type        AiJobType
  status      AiJobStatus @default(PENDING)
  input       Json        // Serialized context for Claude
  output      Json?       // Structured result from Claude
  error       String?
  bullmqJobId String?     // BullMQ job ID for tracking
  projectId   String
  requestedBy String
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  project     Project     @relation(fields: [projectId], references: [id])
  user        User        @relation(fields: [requestedBy], references: [id])
}

// =====================
// REPORTS
// =====================

model Report {
  id          String    @id @default(cuid())
  type        String    // 'daily' | 'weekly'
  content     String    // AI-generated markdown
  projectId   String
  generatedAt DateTime  @default(now())
  blueprintId String?

  project     Project   @relation(fields: [projectId], references: [id])
}

// =====================
// BLUEPRINT SYNC (transactional outbox)
// =====================

model BlueprintSync {
  id          String      @id @default(cuid())
  entityType  String      // 'task' | 'time_log' | 'report'
  entityId    String
  status      SyncStatus  @default(PENDING)
  attempts    Int         @default(0)
  lastError   String?
  projectId   String
  taskId      String?
  syncedAt    DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  project     Project     @relation(fields: [projectId], references: [id])
  task        Task?       @relation(fields: [taskId], references: [id])
}
```

### NestJS AuthModule Setup

```typescript
// apps/api/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
  ],
  providers: [JwtStrategy, RolesGuard],
  exports: [PassportModule, RolesGuard],
})
export class AuthModule {}
```

### BullMQ Queue Module Setup

```typescript
// apps/api/src/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: 'ai-jobs' }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

### PrismaService

```typescript
// apps/api/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### ProtectedRoute Component

```typescript
// apps/web/src/auth/ProtectedRoute.tsx
import { useAuth } from './AuthProvider';
import keycloak from './keycloak';

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { authenticated, roles } = useAuth();

  if (!authenticated) {
    keycloak.login();
    return null;
  }

  if (requiredRole && !roles.includes(requiredRole)) {
    return <div>Access denied. Required role: {requiredRole}</div>;
  }

  return <>{children}</>;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `keycloak-connect` backend adapter | `openid-client` v6 + `passport-jwt` + `jwks-rsa` | 2022 (Keycloak official deprecation) | Must not use keycloak-connect in any new code |
| `@react-keycloak/web` wrapper library | Direct `keycloak-js` with module singleton | 2023-2024 (react-keycloak/web unmaintained, has StrictMode issues) | Use keycloak-js directly; the wrapper library has open StrictMode bugs |
| `Bull` (legacy) queue | `BullMQ` | 2021 | Bull is in maintenance mode only; BullMQ is the rewrite |
| Create React App | Vite | 2023 (CRA unmaintained) | Never use CRA |
| `keycloak.init({ onLoad: 'login-required' })` | `onLoad: 'check-sso'` + silent SSO | Current best practice | `login-required` forces redirect on every app load; `check-sso` is non-disruptive |

**Deprecated/outdated:**
- `@react-keycloak/web`: last meaningful update 2022; open React 18 StrictMode infinite loop issue; use keycloak-js directly
- `keycloak-connect`: officially deprecated by Keycloak in 2022
- `nest-keycloak-connect`: internally wraps the deprecated adapter; do not use
- `Bull` (npm: bull): maintenance mode only; use BullMQ

---

## Open Questions

1. **openid-client v6 compatibility with the company Keycloak version**
   - What we know: `openid-client` v6 is a breaking rewrite from v5; compatibility requires Keycloak 22+ per CLAUDE.md version notes
   - What's unclear: The exact Keycloak version running on company infrastructure is not documented
   - Recommendation: Before implementing, obtain the Keycloak server version. If Keycloak < 22, evaluate `openid-client` v5 instead. This is flagged as a known concern in STATE.md.

2. **Keycloak OIDC discovery endpoint accessibility from NestJS Docker container**
   - What we know: `jwks-rsa` fetches `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs` at JWT validation time
   - What's unclear: Whether the company Keycloak server is accessible from the Docker network (vs. requiring host network or DNS configuration)
   - Recommendation: In Docker Compose, the `api` container must be able to reach the Keycloak URL. Use host networking or configure DNS in `docker-compose.yml` if Keycloak is on a separate company server.

3. **pnpm not installed on development machines**
   - What we know: `pnpm` is not present in the current environment (confirmed by environment audit below)
   - What's unclear: Whether the development team has pnpm installed or prefers npm/yarn
   - Recommendation: Include pnpm installation as the first task in Wave 0. Use `npm install -g pnpm@10` or corepack.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | NestJS API, Vite frontend | Yes | 22.22.2 (LTS) | — |
| npm | Package installation | Yes | bundled with Node | — |
| pnpm | Monorepo workspace management | No | — | Install via `npm install -g pnpm@10` |
| Docker | Full dev stack in containers | No | — | Run PostgreSQL + Redis locally (homebrew/native) |
| docker-compose / docker compose | One-command dev stack | No | — | Same as Docker fallback |
| PostgreSQL client (psql) | Database verification | Yes | 18.3 | — |
| Redis CLI | Redis health verification | No | — | Use `docker exec` into Redis container |

**Missing dependencies with no fallback:**
- None — all missing tools have installation paths or viable alternatives for local dev.

**Missing dependencies requiring installation steps in Wave 0:**
- `pnpm`: Required for D-01 monorepo structure. Install as first task: `npm install -g pnpm@10`
- `Docker` + `docker compose`: Required for success criterion 5 (one-command dev stack). Must be installed for Docker Compose workflow. Alternative: developers can run PostgreSQL/Redis natively (homebrew on macOS) for initial dev, but Docker Compose is required for the success criterion.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (per CLAUDE.md — Vite-native, replaces Jest) |
| Config file | `vitest.config.ts` per app — Wave 0 creates these |
| Quick run command (API) | `pnpm --filter @pm/api test --run` |
| Quick run command (Web) | `pnpm --filter @pm/web test --run` |
| Full suite command | `pnpm -r test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Keycloak login redirects correctly; Bearer token accepted by API | Integration (mock Keycloak) + Manual | `pnpm --filter @pm/api test --run auth` | Wave 0 |
| AUTH-02 | Token refresh: expired token triggers refresh, session persists | Unit (keycloak mock) | `pnpm --filter @pm/web test --run auth` | Wave 0 |
| AUTH-03 | Logout clears session and redirects | Unit (keycloak mock) | `pnpm --filter @pm/web test --run auth` | Wave 0 |
| RBAC-01 | PM role passes RolesGuard on PM-only endpoints | Unit (guard unit test) | `pnpm --filter @pm/api test --run roles` | Wave 0 |
| RBAC-02 | BA role rejected on PM-only endpoint (403) | Unit (guard unit test) | `pnpm --filter @pm/api test --run roles` | Wave 0 |
| RBAC-03 | Developer role accepted on developer-accessible endpoints | Unit (guard unit test) | `pnpm --filter @pm/api test --run roles` | Wave 0 |
| RBAC-04 | Leadership role accepted on read-only endpoints, rejected on write endpoints | Unit (guard unit test) | `pnpm --filter @pm/api test --run roles` | Wave 0 |

**Note on AUTH-01:** Full Keycloak Authorization Code flow cannot be fully automated in unit tests without a live Keycloak instance. The RolesGuard and JWT strategy are tested with mocked JWTs. Auth-01 end-to-end (actual login page → redirect → token) is manually verified as part of the Docker Compose smoke test.

### Sampling Rate

- **Per task commit:** `pnpm --filter @pm/api test --run` (API guard + strategy tests)
- **Per wave merge:** `pnpm -r test --run` (full suite across all apps)
- **Phase gate:** Full suite green + manual Docker Compose smoke test before `/gsd:verify-work`

### Wave 0 Gaps

- `apps/api/src/auth/roles.guard.spec.ts` — unit tests for RolesGuard (RBAC-01 through RBAC-04)
- `apps/api/src/auth/jwt.strategy.spec.ts` — unit tests for JWT extraction and role mapping (AUTH-01)
- `apps/web/src/auth/AuthProvider.test.tsx` — unit tests for keycloak-js init guard and context (AUTH-02, AUTH-03)
- `apps/api/vitest.config.ts` — Vitest configuration for NestJS app
- `apps/web/vitest.config.ts` — Vitest configuration for React app (Vite plugin required)
- Framework install: `pnpm add -D vitest @vitest/coverage-v8` in each app

---

## Sources

### Primary (HIGH confidence)

- npm registry (live 2026-04-05) — exact versions for keycloak-js (26.2.3), openid-client (6.8.2), @nestjs/passport (11.0.5), passport-jwt (4.0.1), jwks-rsa (4.0.1), bullmq (5.73.0), @nestjs/bullmq (11.0.4), prisma (7.6.0), @nestjs/config (4.0.3), pnpm (10.33.0)
- [Keycloak Adapter Deprecation](https://www.keycloak.org/2022/02/adapter-deprecation) — official Keycloak blog, keycloak-connect deprecated 2022
- [Keycloak JavaScript Adapter docs](https://www.keycloak.org/securing-apps/javascript-adapter) — official keycloak-js configuration reference
- [Prisma Official Docs — Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations) — one-to-many relations, @relation syntax
- [Docker Compose startup order docs](https://docs.docker.com/compose/how-tos/startup-order/) — health check + depends_on pattern
- [Vite Server Options](https://vite.dev/config/server-options) — host, HMR, watch configuration

### Secondary (MEDIUM confidence)

- [NestJS Keycloak guide (Jan 2026)](https://nimeshpiyumantha.medium.com/secure-your-api-with-keycloak-a-complete-guide-for-nestjs-0598684813d0) — JWT strategy + roles pattern; verified against NestJS Passport docs
- [DEV Community — pnpm workspaces NestJS React](https://dev.to/lico/step-by-step-guide-sharing-types-and-values-between-react-esm-and-nestjs-cjs-in-a-pnpm-monorepo-2o2j) — workspace:* protocol, shared types pattern
- [skycloak.io — React Keycloak PKCE](https://skycloak.io/blog/secure-react-api-access-using-keycloak-oidc-pkce/) — PKCE configuration, check-sso pattern
- [DEV Community — Dockerize NestJS Prisma Redis](https://dev.to/manuchehr/dockerize-nestjs-app-with-postgres-redis-prisma-orm-1130) — Docker Compose service structure

### Tertiary (LOW confidence — flag for validation)

- keycloak-js v26 breaking changes vs earlier versions — training data partially confirms ESM-only exports; validate against live keycloak-js v26 CHANGELOG before implementation
- openid-client v6 vs v5 compatibility with specific Keycloak versions — STATE.md flags this as known concern; requires human verification of company Keycloak version

---

## Project Constraints (from CLAUDE.md)

All items below are mandatory directives. The planner MUST NOT recommend approaches that contradict them.

| Directive | Constraint |
|-----------|-----------|
| Auth provider | Keycloak SSO only — no other auth providers |
| AI runtime | Claude Code CLI on separate server, queue-based — NOT Claude API |
| Frontend framework | React 19 + Vite 8 — not Next.js (WebSocket complexity, no SSR needed) |
| Backend framework | NestJS 11 — not Express or FastAPI |
| Database | PostgreSQL 16 + Prisma 7 — not MongoDB, not TypeORM, not Drizzle |
| Queue | BullMQ 5 + Redis 7 — not Bull (legacy), not RabbitMQ |
| State management | TanStack Query (server state) + Zustand (client state) — not Redux |
| Keycloak backend lib | `openid-client` v6 + `passport-jwt` — NEVER `keycloak-connect` or `nest-keycloak-connect` |
| Keycloak frontend lib | `keycloak-js` (browser/public client only) — confirmed in CLAUDE.md |
| Node.js version | 20+ LTS (NestJS 11 requirement) — current environment has 22.22.2, satisfies this |
| Package manager | pnpm (not npm or yarn) for the monorepo |
| ORM migrations | `prisma migrate dev` (dev) / `prisma migrate deploy` (prod) — never raw SQL |
| Deployment | On-premise — no cloud dependencies |
| Scope | POC: prove end-to-end flow first |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on 2026-04-05
- Architecture patterns: HIGH — singleton keycloak-js, passport-jwt + jwks-rsa, Docker health checks are standard verified patterns
- RBAC pattern: HIGH — NestJS official docs pattern (@SetMetadata + Reflector + RolesGuard)
- Prisma schema: HIGH — official Prisma docs for relations and enums; schema content is discretionary (follows best practices)
- openid-client v6 vs Keycloak version compatibility: LOW — company Keycloak version unknown; flagged as open question

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable libraries; keycloak-js and NestJS move moderately fast)
