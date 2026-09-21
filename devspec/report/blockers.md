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
