---
phase: 1
slug: infrastructure-baseline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (Vite-native, replaces Jest — per CLAUDE.md) |
| **Config file** | `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts` — Wave 0 creates these |
| **Quick run command** | `pnpm -r test --run` |
| **Full suite command** | `pnpm -r test --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @pm/api test --run`
- **After every plan wave:** Run `pnpm -r test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-01 | Integration (mock JWT) | `pnpm --filter @pm/api test --run auth` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AUTH-02 | Unit (keycloak mock) | `pnpm --filter @pm/web test --run auth` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | AUTH-03 | Unit (keycloak mock) | `pnpm --filter @pm/web test --run auth` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | RBAC-01 | Unit (guard test) | `pnpm --filter @pm/api test --run roles` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | RBAC-02 | Unit (guard test) | `pnpm --filter @pm/api test --run roles` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | RBAC-03 | Unit (guard test) | `pnpm --filter @pm/api test --run roles` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | RBAC-04 | Unit (guard test) | `pnpm --filter @pm/api test --run roles` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/vitest.config.ts` — Vitest configuration for NestJS app
- [ ] `apps/web/vitest.config.ts` — Vitest configuration for React app
- [ ] `apps/api/src/auth/roles.guard.spec.ts` — unit tests for RolesGuard (RBAC-01 through RBAC-04)
- [ ] `apps/api/src/auth/jwt.strategy.spec.ts` — unit tests for JWT extraction and role mapping (AUTH-01)
- [ ] `apps/web/src/auth/AuthProvider.test.tsx` — unit tests for keycloak-js init guard and context (AUTH-02, AUTH-03)
- [ ] Framework install: `pnpm add -D vitest @vitest/coverage-v8` in each app

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full Keycloak login flow (redirect → consent → token) | AUTH-01 | Requires live Keycloak instance with browser redirect | 1. `docker-compose up` 2. Open http://localhost:5173 3. Verify redirect to Keycloak login page 4. Enter credentials 5. Verify redirect back to app with authenticated session |
| Docker Compose one-command startup | SC-5 | Infrastructure verification, not code logic | 1. `docker-compose up -d` 2. Verify all services healthy: `docker-compose ps` 3. Verify API responds: `curl http://localhost:3000/health` 4. Verify frontend loads: open http://localhost:5173 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
