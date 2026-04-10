# Wiki Fixes: Dir Path, Concurrency & Progress Banner

**Date:** 2026-04-10
**Scope:** 3 targeted fixes to the existing Project Wiki feature

---

## 1. Wiki Directory Path from `.env`

### Problem
`wikiPath` is a free-text input in Settings, stored per-project in the DB. It should follow the same pattern as `WORKSPACE_DIR` — configured in `.env`, resolved by the backend, with projectId appended automatically.

### Design

**Backend:**
- Add `WIKI_DIR` to `.env.example` (default: `wikis`)
- In `WikiGenerationService.getProjectConfig()`, compute `wikiPath` from env instead of reading from DB:
  ```
  const configDir = this.config.get<string>('WIKI_DIR', 'wikis');
  const baseDir = isAbsolute(configDir) ? configDir : resolve(process.cwd(), '..', '..', configDir);
  const wikiPath = join(baseDir, projectId);
  ```
- Remove `wikiPath` from `UpsertWikiConfigDto` (no longer user-configurable)
- Remove `wikiPath` column from `WikiConfig` prisma model
- Update `WikiConfigService.upsert()` to drop `wikiPath` from create/update
- Add a helper method `getWikiPath(projectId: string): string` on `WikiGenerationService` for reuse by `WikiService` (page tree, content reading, Q&A)
- Update `WikiService` constructor to inject `ConfigService`, and replace all `config.wikiPath` reads with the computed path
- Update `WikiController` to pass the computed path when enqueuing Q&A jobs

**Frontend:**
- Remove `wikiPath` state and input from `WikiConfigCard.tsx`
- Remove `wikiPath` from `UpsertWikiConfigPayload` type
- Update `useUpsertWikiConfig` mutation payload type
- Show the resolved wiki path as read-only info text (fetched from `WikiConfig` response, which will include a computed `wikiPath` field for display)

**API response:** The `GET /wiki/config` response will still include a `wikiPath` field (computed server-side, not from DB) so the frontend can display it.

**Migration:** Prisma migration to drop `wikiPath` column from `WikiConfig` table.

---

## 2. Global Concurrency = 1

### Problem
`WikiGenerationProcessor` has `concurrency: 2`, allowing 2 wiki jobs to run simultaneously. Wiki generation is resource-intensive and should be limited to 1 at a time globally.

### Design

- Change `@Processor('wiki-generation', { concurrency: 2 })` to `@Processor('wiki-generation', { concurrency: 1 })` in `wiki-generation.processor.ts`
- Add a check in `WikiGenerationController.generate()` before enqueuing: query the BullMQ queue for active jobs. If one is already running, return a 409 Conflict with a message like `"Wiki generation is already in progress. Please wait for it to complete."`
- Frontend: handle 409 in `useWikiGeneration` — show a toast with the conflict message instead of generic error

This is sufficient for a single API instance. The BullMQ worker naturally processes one job at a time with `concurrency: 1`.

---

## 3. Progress Banner Fix

### Problem
The banner in `WikiPage.tsx` never appears because:
1. Condition `isActive && totalSections > 0` requires section-start events to fire first
2. `sectionProgress` starts empty and only populates via socket events
3. If user navigates to WikiPage after triggering from Settings, `jobId` is null — no tracking

### Design

**A. Show banner during all active phases:**
- Change banner condition from `isActive && totalSections > 0` to just `isActive`
- Show step-appropriate messages:
  - `queued` -> "Waiting in queue..."
  - `pulling` -> "Pulling latest code..."
  - `building-graph` -> "Building code graph..."
  - `generating-sections` -> show section progress (existing UI)
  - `writing-meta` -> "Finalizing..."

**B. Pre-populate section progress:**
- When `generate.mutate()` succeeds (onSuccess), immediately populate `sectionProgress` with all sections from the wiki config, each with status `pending`
- Pass the config's `sections` array into the mutation context

**C. Recover active job on mount (cross-page navigation):**
- Add a new endpoint `GET /projects/:projectId/wiki/generate/active` that returns the currently active/waiting job (if any) with its current progress state
- Backend: query the BullMQ queue for active + waiting jobs for this project, return the first one's id, state, and progress
- Frontend: `useWikiGeneration` calls this endpoint on mount. If an active job is found, restore `jobId`, `step`, and `sectionProgress` from the response, and resume socket listening
- This also solves the page-refresh scenario

**D. Banner UI update:**
- Early phases (before sections): show a single-line banner with spinner + step message
- Section phase: show the existing multi-badge layout
- Add a subtle progress bar at the top of the banner showing overall completion

### Files Changed

**Backend:**
- `apps/api/.env.example` — add `WIKI_DIR=wikis`
- `apps/api/prisma/schema.prisma` — remove `wikiPath` from `WikiConfig`
- `apps/api/src/wiki-config/dto/upsert-wiki-config.dto.ts` — remove `wikiPath`
- `apps/api/src/wiki-config/wiki-config.service.ts` — remove `wikiPath` from upsert
- `apps/api/src/wiki-config/wiki-config.controller.ts` — include computed `wikiPath` in response
- `apps/api/src/wiki-generation/wiki-generation.service.ts` — add `getWikiPath()`, update `getProjectConfig()`
- `apps/api/src/wiki-generation/wiki-generation.processor.ts` — change concurrency to 1
- `apps/api/src/wiki-generation/wiki-generation.controller.ts` — add active-job endpoint, add 409 check
- `apps/api/src/wiki/wiki.service.ts` — inject ConfigService, use computed path
- `apps/api/src/wiki/wiki.controller.ts` — use computed path for Q&A jobs

**Frontend:**
- `apps/web/src/lib/types.ts` — remove `wikiPath` from `UpsertWikiConfigPayload`
- `apps/web/src/lib/api.ts` — no change needed
- `apps/web/src/hooks/useWiki.ts` — update mutation payload type
- `apps/web/src/hooks/useWikiGeneration.ts` — add active-job recovery on mount, pre-populate sections
- `apps/web/src/components/settings/WikiConfigCard.tsx` — remove wikiPath input, show read-only path
- `apps/web/src/pages/WikiPage.tsx` — fix banner condition, add step messages
