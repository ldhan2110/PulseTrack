# AI Bug Fix — Design Spec

**Date:** 2026-05-04  
**Status:** Draft  
**Scope:** Server-side AI-powered bug fixing with automated MR creation

## Overview

Users click "AI Fix" on a bug in PulseTrack. The system invokes a Claude/Gemini/Codex CLI on the server to analyze the bug, fix the code, and create a merge request — all automated. Developers only review the MR.

## Decisions

| Decision | Choice |
|----------|--------|
| CLI execution | Server-side via BullMQ (same as AI task generation) |
| Concurrency | Git worktrees — parallel fixes on same project, no conflicts |
| Same-bug lock | Reject duplicate while fix in progress (409 Conflict) |
| Re-fix | New branch with sequence number (`fix/BUG-123-slug-2`), old MR stays |
| Guidance | Always available — optional textarea on every attempt |
| Test cases | Include linked test cases, toggle (default on) |
| MR description | AI-generated: root cause + solution + files changed |
| Architecture | Single BullMQ job + try/finally cleanup + orphan cron |
| CLI timeout | None — let it run to completion |
| Code graph | Always build code-review-graph first, use it during fix |
| Cancel | Yes — SIGTERM + cleanup worktree |

---

## 1. Data Model

### New Prisma model: `AiBugFix`

```prisma
model AiBugFix {
  id             String    @id @default(cuid())
  bugId          String
  projectId      String
  requesterId    String
  status         String    @default("queued")  // queued | preparing | fixing | pushing | creating-mr | completed | failed | cancelled
  targetBranch   String
  branchName     String?
  worktreePath   String?
  guidance       String?   @db.Text
  includeTests   Boolean   @default(true)
  rootCause      String?   @db.Text
  solution       String?   @db.Text
  filesChanged   String?   @db.Text
  prUrl          String?
  prNumber       Int?
  errorMessage   String?
  attempt        Int       @default(1)
  jobId          String?
  createdAt      DateTime  @default(now())
  completedAt    DateTime?

  bug       Bug     @relation(fields: [bugId], references: [id], onDelete: Cascade)
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  requester User    @relation("AiBugFixRequester", fields: [requesterId], references: [id])

  @@index([bugId, status])
}
```

**Lock mechanism:** Before enqueue, query `AiBugFix WHERE bugId = X AND status IN ('queued','preparing','fixing','pushing','creating-mr')`. If exists → 409.

**Attempt sequencing:** `SELECT COUNT(*) FROM AiBugFix WHERE bugId = X` + 1.

---

## 2. Backend Module Structure

```
apps/api/src/ai-bug-fix/
├── ai-bug-fix.module.ts
├── ai-bug-fix.controller.ts
├── ai-bug-fix.service.ts         # Prompt building, validation, config
├── ai-bug-fix.processor.ts       # BullMQ worker — main pipeline
├── ai-bug-fix.cleanup.ts         # @Cron orphan worktree cleanup
└── dto/
    ├── create-ai-fix.dto.ts      # { targetBranch, guidance?, includeTests? }
    └── ai-fix-result.dto.ts
```

### API Endpoints (on BugsController)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `projects/:projectId/bugs/:bugId/ai-fix` | Start AI fix |
| `GET` | `projects/:projectId/bugs/:bugId/ai-fixes` | List fix attempts |
| `GET` | `projects/:projectId/bugs/:bugId/ai-fixes/:fixId` | Get fix status |
| `DELETE` | `projects/:projectId/bugs/:bugId/ai-fixes/:fixId` | Cancel in-progress fix |

### WebSocket Events

| Event | Payload |
|-------|---------|
| `ai-bug-fix:progress` | `{ fixId, step, jobId }` |
| `ai-bug-fix:stream` | `{ fixId, text }` — live CLI output |
| `ai-bug-fix:completed` | `{ fixId, prUrl, prNumber, rootCause, solution }` |
| `ai-bug-fix:failed` | `{ fixId, error }` |

---

## 3. Pipeline Flow (Processor)

Single BullMQ job wrapped in try/finally for cleanup guarantee.

### Step 1: PREPARE
1. `git pull` on main worktree (update default branch)
2. Generate branch name: `fix/{bugKey}-{slug}[-N]` (N = sequence if attempt > 1)
3. `git worktree add {worktreePath} -b {branchName} origin/{targetBranch}`
4. Save `worktreePath` + `branchName` to AiBugFix record
5. Emit `ai-bug-fix:progress { step: 'preparing' }`

### Step 2: BUILD PROMPT
1. Fetch bug with all relations (reproSteps, attachments)
2. Fetch linked test cases if `includeTests=true` (via TestCaseLink where entityType=BUG)
3. Fetch previous attempts if `attempt > 1` (rootCause + solution + guidance)
4. Include `AiConfig.projectContext`
5. Compose structured prompt (see Section 4)

### Step 3: SPAWN CLI
1. Build CLI args via `AiTaskGenerationService.buildCliArgs()` pattern
2. Set CLI env via `AiTaskGenerationService.buildCliEnv()` pattern
3. Spawn CLI in worktree cwd — **no timeout**
4. Stream stdout/stderr via WebSocket `ai-bug-fix:stream`
5. Store CLI child process PID for cancel support
6. Emit `ai-bug-fix:progress { step: 'fixing' }`

### Step 4: PARSE OUTPUT
1. Regex extract `<ai-fix-analysis>` block from CLI stdout
2. Split on `ROOT_CAUSE:`, `SOLUTION:`, `FILES_CHANGED:` markers
3. Save parsed fields to AiBugFix record
4. If tags missing → set fallback text, continue to push

### Step 5: PUSH + CREATE MR
1. `git push origin {branchName}` from worktree
2. Build MR description from parsed analysis
3. Create MR via `GitProvider.createPr()`
4. Save `prUrl`, `prNumber` to AiBugFix record
5. Emit `ai-bug-fix:progress { step: 'creating-mr' }`

### Step 6: CLEANUP (finally block)
1. `git worktree remove {worktreePath} --force`
2. `git branch -D {branchName}` (local only — remote branch stays for MR)
3. Update AiBugFix status → `completed` or `failed`
4. Set `completedAt`
5. Emit completion or failure WebSocket event

### Cancel Flow
1. `DELETE /:bugId/ai-fixes/:fixId` → look up job by `jobId`
2. Send SIGTERM to CLI child process
3. Cleanup worktree in finally block (same path as failure)
4. Set status → `cancelled`

### Orphan Cleanup (`@Cron('0 */15 * * * *')`)
- Query AiBugFix where status IN (`preparing`, `fixing`, `pushing`) AND `createdAt < 30 min ago`
- Force-remove worktrees, mark as failed with error "Timed out — orphan cleanup"

---

## 4. Prompt Structure

```
You are a senior developer fixing a bug in a codebase.

## Step 1: Build Knowledge Graph
Build or update the code-review-graph for this repository using MCP tools.

## Step 2: Analyze with Code Graph
Use semantic_search_nodes_tool, query_graph_tool, get_impact_radius_tool
to understand the area of code related to this bug before making changes.

## Step 3: Fix the Bug
Make minimal, surgical changes. Do not refactor unrelated code.
Commit your changes with clear commit messages.

## Step 4: Output Analysis
After fixing, output EXACTLY this format (no markdown fences):
<ai-fix-analysis>
ROOT_CAUSE: [1-3 sentences explaining why the bug happened]
SOLUTION: [1-3 sentences explaining what you changed and why]
FILES_CHANGED: [comma-separated list of changed files with brief reason]
</ai-fix-analysis>

## Bug Details
Title: {title}
Severity: {severity}
Key: {bugKey}
Description: {description}
Expected Result: {expectedResult}
Actual Result: {actualResult}
Preconditions: {preconditions}
Environment: {environment}

## Reproduction Steps
1. {step.content}
2. {step.content}
...

## Attachments
- {filePath} ({mimeType})
...

## Linked Test Cases (verify fix satisfies these)          ← if includeTests=true
### TC: {testCase.title}
Preconditions: {testCase.preconditions}
Steps:
1. Action: {step.action} → Expected: {step.expectedResult}
...

## Previous Attempts (user was not satisfied)               ← if attempt > 1
Attempt {N}:
  Root cause: {rootCause}
  Solution: {solution}
  User feedback: {guidance}

## Additional Guidance from Developer                       ← if guidance provided
{guidance}

## Project Context                                          ← from AiConfig.projectContext
{projectContext}
```

### MR Description Template

```markdown
## Root Cause
{parsed rootCause}

## Solution
{parsed solution}

## Files Changed
{parsed filesChanged}

## Bug Reference
{bugKey}: {title}
```

Fallback if `<ai-fix-analysis>` not found:
```markdown
## AI Bug Fix
Automated fix for {bugKey}: {title}
AI analysis not available — review changes manually.
```

---

## 5. Frontend

### New Files

```
components/bugs/AiFixDialog.tsx       # Dialog with form + progress view
components/bugs/AiFixHistory.tsx      # Fix attempts list on bug detail
hooks/useAiBugFix.ts                  # React Query + WebSocket
lib/api.ts                            # +startAiFix, getAiFixes, getAiFix, cancelAiFix
lib/types.ts                          # +AiBugFix type
```

### AiFixDialog

**Form state (initial view):**
- Target branch — Select dropdown, fetches `listRemoteBranches()`
- Include linked test cases — Switch toggle, default on
- Additional guidance — Textarea, optional
- Previous attempts — collapsible section if `attempt > 1` (shows branch, MR link, root cause, solution per attempt)
- Submit button → POST, transitions to progress view

**Progress state:**
- Live terminal output (WebSocket `ai-bug-fix:stream`) — same terminal component as AI task generation
- Step indicator: preparing → fixing → pushing → creating MR → done
- Cancel button — calls DELETE endpoint

**Completed state:**
- MR link (clickable)
- Root cause + solution display
- "Close" button

### AiFixHistory

On BugDetailPage — list of past AI fix attempts:
- Attempt number, status badge, date
- MR link if exists
- Root cause preview (truncated)
- Click to expand full details

### Lock UX

If bug has in-progress fix:
- "AI Fix" button → disabled, shows "Fix in progress..."
- Other users see same disabled state via query cache

---

## 6. Error Handling

| Scenario | Handling |
|----------|----------|
| Repo not cloned | Reject: "Repository must be cloned first" |
| AI config missing | Reject: "AI configuration not found" |
| Worktree creation fails | Mark failed, emit error, no cleanup needed |
| CLI exits non-zero | Save stderr to errorMessage, mark failed, cleanup worktree |
| `<ai-fix-analysis>` missing | Still create MR with fallback description |
| `git push` fails | Mark failed, cleanup worktree |
| MR creation fails | Mark failed, save branchName for manual MR |
| Server crash mid-job | Orphan cron catches within 15 min |
| Duplicate fix on same bug | 409 Conflict |
| Bug has sparse data | Prompt adapts — includes whatever fields are available |
| Binary attachments | Claude: pass file paths (reads images). Others: note "[Binary file]" |
| User cancels | SIGTERM CLI process, cleanup worktree, status → cancelled |

---

## 7. Migration

Prisma migration for `AiBugFix` model. Also add `aiBugFixes AiBugFix[]` relation arrays to `Bug`, `Project`, and `User` models.
