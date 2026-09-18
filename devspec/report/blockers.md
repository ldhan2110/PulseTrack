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
