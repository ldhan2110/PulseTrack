# Blockers

## add-agent-write-consent — section 3 verify red (pre-existing, unrelated)

**When**: 2026-09-18 (run worker-cc)
**Section**: 3. Gate write scopes on consent — `Verify: pnpm --filter @pm/api test mcp-tools`
**Status**: implementation complete (3.1–3.4 done); verify command red.

**What happened**
Section 3 code is done and correct: `McpSession.allowWrite` added + set from token row (`mcp-pat.guard.ts`), `WRITE_SCOPES` set + consent gate in `requireScope` (`mcp-server.service.ts`), and 4 new consent tests in `mcp-tools.spec.ts`. Scoped run confirms them green:
`pnpm --filter @pm/api exec vitest run mcp-tools -t "consent gate"` → **4 passed, 17 skipped**.

But the section's verify runs the whole file and is **red on 3 failures**:
1. `MCP write tools > registers the full read+write surface` — expected list omits `attach_task_file` (tool exists in service, missing from the test's expected array).
2. `MCP test-execution tools > create_test_execution …` — `Cannot read properties of undefined (reading 'testCase')` (mock `testExecutions.create` shape drift).
3. `MCP test-execution tools > attach_result_file …` — same test-execution mock drift.

**These are pre-existing on HEAD**, not caused by this change. Proof: stashing all three edited files and running `pnpm --filter @pm/api test mcp-tools` on clean HEAD → **14 passed | 3 failed** (same 3). My change adds +4 passing consent tests → **18 passed | 3 failed**. Zero regressions; net +4 green.

**Why blocked, not ticked**
The verify command is red. Per worker rules a section is satisfied only when its `Verify:` passes, and a lying green is worse than an honest block. The 3 failing tests concern unrelated features (`attach_task_file`, `create_test_execution` mock) — fixing them is an out-of-scope neighbor edit the spec did not request (surgical-changes rule). Not one of the four hard-block cases; logged and stopped per "unresolvable + not hard-block".

**To resolve (human)**
Either (a) fix/refresh the 3 pre-existing `mcp-tools.spec.ts` expectations+mocks so the file is green (small, but out of this change's scope), or (b) narrow section 3's verify to the consent tests (`... test mcp-tools -t "consent gate"`) if the pre-existing failures are tracked separately. Then reset board `status: blocked → pending` and re-run.

**Sections done before stop**: 1 (migration), 2 (persist+expose) — both verified green. Sections 4 (frontend) + 5 (full build) not started.

**status: resolved** (2026-09-18) — human ruled the 3 pre-existing failures out of scope; section 3 verify narrowed to `... test mcp-tools -t "consent gate"` (green, exit 0). Change resumed.

## add-realtime-chat-web — §1.2/§6 missing dependency endpoint + §8.2 MANUAL gate
_worker-cc · 2026-09-21_

**status: open** — two independent human-gated blockers

### 1. Missing chat-target search/discovery endpoint (hard-block: impossible as written)
req-3 + design.md architecture require `api.searchChatTargets(q)` returning **all people AND channels, including never-messaged, cross-project** (§1.2, §1.3 `useSearchChatTargets`, §4.1 search box, §6 whole overlay, §8.1 wiring).

The `depends_on` backend `add-realtime-chat` shipped **no such endpoint**:
- `chat.controller.ts` — 9 routes, none search/discover.
- Backend spec req-1..req-12 — no search/discovery requirement.
- Only user search that a normal user can call: `GET /projects/:projectId/members/search` — **project-scoped**, needs a projectId; the `/chat` page is global/cross-project (design default: "chat crosses projects").
- `GET /users` is **admin-only** (`SystemRolesGuard @SystemRoles('admin')`); `GET /users/me` is self.
- **No channel-discovery endpoint at all** (search channels not joined).

Can't resolve in-scope: this change's Blast Radius is web-only ("NotificationBell/notification code untouched; new files + one route + one sidebar item"). Adding a NestJS route (+guard +DTO +test) is a redesign of the backend dependency — not a web-only edit and not covered by any Impact Area Decision Default. Narrowing req-3 to project-scoped people-only (drop cross-project + channel discovery) is a spec change only the author/BA may make.

### 2. §8.2 terminal MANUAL gate
`- [ ] MANUAL: BA approves screenshot of /chat against mockups/chat-page.html` is unticked. Per worker rules an unticked MANUAL gate blocks the change; it cannot reach `done` autonomously this run regardless of blocker 1.

**To resume:** a human picks one of —
- (a) add a chat-target search endpoint to the backend (e.g. `GET /chat/search?q=` returning people + channels, member-gated) and record its contract, then the FE can implement §1.2/§6; **or**
- (b) amend FE req-3 to reuse `GET /projects/:projectId/members/search` (project-scoped, people-only, drop channel discovery) with a Decision Default in design.md.
Then tick §8.2 after the BA screenshot review, and reset board `status: blocked → pending`.

**No code written this run** — blocker 1 surfaces at §1.2 (top of the data layer, before any section can complete its Verify), so no section was completable; committing partial unverified UI would be a lying-green.

**status: resolved** (2026-09-21, same session) — user cleared both: (1) search source = reuse project-scoped `members/search`, people-only, channels tab = joined channels + create (Decision Default recorded in design.md, narrows req-3 §6); (2) §8.2 MANUAL BA-approved ("auto go"). Change built end-to-end, verified (devspec-verify PASS), and archived as done.

## chat-members-mentions — §9 MANUAL BA visual sign-off (unticked)

**status: open** — human BA visual sign-off pending
**When**: 2026-09-22 (run worker-cc)
**Section**: 9. Visual sign-off — `Verify: MANUAL: BA approves screenshot`
**Status**: §1–§8 all implemented + verified; §9.1 MANUAL box unticked → blocked (never self-approve).

**What's done (verified)**
- §1 add/remove member endpoints + DTO + service (`chat.service.ts`, `chat.controller.ts`, `dto/add-members.dto.ts`) — `pnpm --filter @pm/api test -- chat.service` green (26 chat.service tests).
- §2 per-user room (`ChatGateway.handleConnection` joins `user:{id}`) + `emitToUser` + membership emits — `chat.gateway` tests green.
- §3 mention parse + `chat:mention` notify in `sendMessage` — tests green (member notified, non-member/self skipped).
- §4 `api.addChatMembers`/`removeChatMember`, `useAddChatMembers`/`useRemoveChatMember`, socket listeners (`chat:conversation:added|removed`, `chat:members:changed` → invalidate; `chat:mention` → toast) — web unit tests green.
- §5 NewConversationDialog DM|Channel toggle + channel create form — devspec-verify live PASS.
- §6 MembersPanel (pill, list, You·Owner badge, add filters existing + live grow, owner remove ✕ + confirm, Leave) — devspec-verify live PASS.
- §7 Composer @mention autocomplete + serialize — unit test + live PASS.
- §8 MessageRow token render (colored bold, own-mention accent + bubble left-border, plain @word untouched) — unit test + live PASS (token color `oklch(0.45 0.17 250)`, transparent bg, matches mockup).
- Both apps build clean (`pnpm --filter @pm/web build`, `pnpm --filter @pm/api build`).
- Live verify @ localhost:5173 (anle@): screenshots in `changes/chat-members-mentions/verify/` (new-conversation-channel, members-panel, remove-confirm, mention-composer, mention-render).

**Why blocked, not ticked**
§9.1 is a `- [ ] MANUAL: BA approves live screenshots vs mockups` gate. Worker rules: never self-approve a MANUAL gate. All engineering is done and green; only human visual sign-off remains.

**To resolve (human)**
Review `changes/chat-members-mentions/verify/*.png` vs `mockups/{new-conversation-dialog,members-panel,mention}.html`. If approved: tick §9.1 `[x]` in `tasks.md` AND reset board `status: blocked → pending`. Next worker run will finish + archive.

**Pre-existing, out of scope**: `McpAccessCard.test` revoked-badge (1 failure, ruled out on 3 prior chat changes) — unrelated to this change.

## external-profile — §8 external editable path: no live browser proof (non-blocking)
_logged: 2026-09-22 by worker-cc_

The EXTERNAL editable variant of the Profile modal was NOT verified in a live
browser: no EXTERNAL test account exists in this environment (only `anle`,
which is INTERNAL/Keycloak). The INTERNAL read-only variant WAS live-verified
(PASS, screenshot in changes/external-profile → archived verify/). Backend
external logic is unit-tested green (12 tests). Change was marked `done` on
that basis per user direction ("skip, I will verify later").

To close: log in as an EXTERNAL user, open Profile from the sidebar, and confirm
name edit + avatar upload + change-password all save and reflect in the sidebar
without reload. Needs an EXTERNAL account (invite→set-password, or a seeded
argon2 user). See improve/testing.md for the missing fixture.

## sidebar-permission-gating — §3 live visual verify not runnable (env, non-blocking to logic)
_logged: 2026-09-22 by worker-cc_

**Section**: 3. Live visual check — `Verify: /devspec-verify sidebar-permission-gating`
**Status**: §1 + §2 complete and verified; §3 could not run in this environment.

**Why §3 can't run now**
1. App not running — web:5173 and api:3000 both down; devspec-verify never fakes a pass against a dead server.
2. No mockups — this change captured a lightweight `ui.md` (no `mockups/*.html`), so the skill's core app↔mockup style-diff rung is N/A; §3 is a presence/absence walk, not a pixel diff.
3. No restricted-role fixture — observing items hide requires the test account in a NON-system role with selective `view` boxes off. `anle` (improve/testing.md) logs in via Keycloak and is effectively admin/system → `can()` returns true → sees every item, so hiding can't be observed without first creating a custom role (bugs.view/wiki.view off) and assigning it in a project.

**Implementation is complete and logic-proven** (not blocked on code):
- §1 `pnpm --filter @pm/web build && --filter @pm/api build` → clean (wiki area compiles both sides; RolesPermissionsTab auto-renders the new Wiki row via PERMISSION_AREAS).
- §2 `vitest run AppSidebar` → 7/7 green against the REAL `PROJECT_NAV_ITEMS` map: Bugs hides on `bugs.view=false`, Wiki hides on `wiki.view=false`, Project Planner collapses when planner+wbs both off, shows only WBS when planner off/wbs on, system role shows all, no-area leaf always shown, source not mutated.
- 8 full-suite web test failures confirmed PRE-EXISTING (identical on clean tree with this change stashed) — unrelated.

**To resolve (human)**
1. Start the app: `pnpm dev:web` + `pnpm dev:api` (see improve/testing.md — web http://localhost:5173, login anle / acbd@).
2. In a project's Settings → Roles & Permissions, create/select a NON-system role, uncheck `Bugs.view` and `Wiki.view` (and both `Planner.view`+`WBS.view` to test parent collapse), save; assign `anle` that role.
3. Re-run `/devspec-verify sidebar-permission-gating` (or eyeball): Bugs + Wiki absent from sidebar, Project Planner gone when planner+wbs off; an admin/system user still sees the full list; collapsed sidebar shows the same reduced set.
4. On pass: tick §3.1 `[x]` in `tasks.md` AND set board `status: blocked → pending` (worker finishes + archives) — or mark `done` directly since §1/§2 are committed.

## delete-project — §5 live verify + §6 manual gate blocked on ops/human (2026-09-23)

**Change**: delete-project — status `blocked`. Implementation COMPLETE and proven; only live/visual verification is blocked.

**Done & verified (automated)**:
- §1 schema `Project.deletedAt` + additive migration `20260923000000_add_project_soft_delete/migration.sql`. Prisma client regenerated OK.
- §2 owner-guarded `DELETE /projects/:projectId` (`remove` in service, controller handler). §3 read-path filters (`findAllForUser`, `findOne`).
- §2.3/§3.3 unit tests: 6 green (`apps/api/src/projects/projects.service.spec.ts`). `nest build` clean.
- §4 web `api.deleteProject` + `useDeleteProject`. §5 `DangerZoneCard` (owner-gated) wired into General tab. Web `tsc -b` + `vite build` clean.

**Blocked**:
1. **§1 migration NOT applied to any running DB.** The only reachable DB is the shared team DB `pm_x` @ 10.0.0.85:5439 — off-limits (rules: never touch live DB), and it already has an unrelated FAILED migration (`20260918000000_add_mcp_allow_write`, P3009). Prisma migrate engine (`rtk`) is absent/shadowed here, so `migrate dev/deploy` can't run locally. No scratch Postgres available in this env.
2. **§5 `/devspec-verify` not runnable.** App is down (web:5173 + api:3000 both down); even started, it points at a DB without the `deletedAt` column, so the feature would 500. Live agent-browser verify requires: human applies the migration to the app's DB + app running.
3. **§6 MANUAL gate unticked.** Needs a second, non-owner account to confirm the Danger Zone card is absent for non-owners — not available in this env. Worker never self-approves.

**To resume** (human):
1. Apply migration `20260923000000_add_project_soft_delete` to the app's DB (the shared-DB P3009 failure is a separate pre-existing issue to resolve first).
2. Start api + web; run `/devspec-verify delete-project` (owner sees styled Danger Zone card + working confirm; deletes + redirects; project gone from list).
3. Log in as a non-owner member, confirm no Danger Zone card on General tab, tick §6.1 `[x]`.
4. Reset board `status: blocked → pending` and re-run, or mark `done` if all verifies pass.

## add-chat-reply — live DB apply + browser verify (env-gated)
_logged: 2026-09-23 by worker-cc_

**All code complete and unit-proven.** API: `nest` types + `chat.service` 140 tests green (+6 new: reply persist, cross-convo 400, missing-target 400, replyTo preview, deleted-parent blank). Web: build clean (tsc+vite), Composer/useChat unit tests pass. Migration file written (`apps/api/prisma/migrations/20260923010000_add_chat_reply/migration.sql`, additive) + Prisma client regenerated.

**Blocked on (all need the app running against a DB that has `Message.replyToId`):**
- §1 verify — migration apply/diff not runnable: shared dev DB (10.0.0.85:5439) is off-limits + diverged from the local migrations dir (`migrate dev` demands a destructive reset — refused), no scratch DB, and the rtk migrate engine is absent (`prisma migrate diff` → "rtk: No such file"). Same env limit `add-project-soft-delete` hit.
- §5/§6/§7 verify (`/devspec-verify add-chat-reply`) — browser check needs the app up with the column present; column absent until the migration is applied.
- §8.1 MANUAL — BA screenshot sign-off vs `mockups/chat-reply.html`; needs the running app + §5-7 verify output.

**To resume (human):**
1. Apply `20260923010000_add_chat_reply` to the app DB (`pnpm migrate:deploy`, or apply the SQL).
2. Start the app (`pnpm dev:api` + `pnpm dev:web`); log in as `anle` / `acbd@`.
3. Run `/devspec-verify add-chat-reply`; work any `verify/fixes.md`.
4. Tick §8.1 `[x]` after BA approves the screenshot, then reset board `status: blocked → pending` and re-run the worker.

## project-field-config — live DB apply + browser verify (env-gated)
_logged: 2026-09-24 by worker-cc_

**All code complete and unit-proven.** API: `nest build` clean; `projects.service` suite green incl. 2 new (`update` persists `fieldConfig`; omits it when absent). Migration file written (`apps/api/prisma/migrations/20260924000000_add_project_field_config/migration.sql`, additive `ADD COLUMN "fieldConfig" JSONB`) + Prisma client regenerated. Web: build clean (tsc+vite); `fieldConfig` helper (4 tests) + `CreateTaskDialog` visibility (4 tests) green. New: `lib/fieldConfig.ts`, `components/settings/ConfigureFieldsDialog.tsx`, General-tab entry card; gated fields in `CreateTaskDialog` (5 present) + `TaskDetailPage` (all 9).

**Blocked on (all need the app running against a DB that has `Project.fieldConfig`):**
- §4/§5 verify (`/devspec-verify project-field-config`) — the running app points at the shared DB `pm_x` (10.0.0.85:5439, off-limits per board); the column is absent there and applying the migration to a shared/live DB is forbidden (rules.md: no direct DDL on live DB), with no scratch DB and rtk migrate engine absent. The dialog Save→PATCH persistence path (and "reopen reflects") can't be exercised until the column exists. Same env wall as `add-project-soft-delete` / `add-chat-reply`.
- §7 MANUAL — BA screenshot sign-off vs `mockups/configure-fields-dialog.html`; needs the running app + §4/§5 verify output.

**To resume (human):**
1. Apply `20260924000000_add_project_field_config` to the app DB (`pnpm migrate:deploy`, or apply the SQL) — additive, no backfill.
2. Start the app; log in as `anle` / `acbd@`.
3. Run `/devspec-verify project-field-config`; work any `verify/fixes.md` (dialog opens from General tab, 9 rows + switches, required-off warning, Save persists + reopen reflects, hidden fields drop from create/detail forms).
4. Tick §7.1 `[x]` after BA approves, then reset board `status: blocked → pending` and re-run the worker.
