# Pitfalls Research

**Domain:** AI-centric project management tool (queue-based Claude Code CLI, Keycloak SSO, Blueprint REST sync, real-time dashboards, on-premise)
**Researched:** 2026-04-05
**Confidence:** MEDIUM-HIGH (mix of official docs, verified sources, and domain reasoning from project context)

---

## Critical Pitfalls

### Pitfall 1: Treating Claude Code CLI Subprocess as a Stateless API Call

**What goes wrong:**
The backend queues a job, shells out to `claude -p`, parses stdout, and returns the result. This seems simple but produces wildly inconsistent output: the CLI loads your entire `~/.claude` configuration, all enabled MCP servers, global CLAUDE.md, and plugins on every invocation. Each subprocess starts at roughly 50K tokens of overhead before doing actual work — and crucially, the prompt formatting, system-prompt injections, and token shapes differ based on the calling machine's local config, making results non-deterministic across team members or deployment environments.

**Why it happens:**
Developers treat `claude -p` like a REST API call (`curl | jq`), not realizing it inherits the interactive developer environment. In dev it works because the dev's machine has a stable config. In a queue worker process on a server, behavior can diverge.

**How to avoid:**
Always invoke Claude Code CLI with `--bare` flag in queue workers. Bare mode skips auto-discovery of hooks, skills, plugins, MCP servers, auto-memory, and CLAUDE.md — only explicit flags take effect. Pass all required context explicitly via `--append-system-prompt-file` and `--settings`. Use `--output-format json` to get structured output and parse `.result` reliably. Define a fixed `--allowedTools` allowlist so the subprocess cannot do unexpected things. Pin a specific configuration JSON passed via `--settings` rather than relying on filesystem state.

```bash
claude --bare \
  -p "Generate user stories for: ${feature_description}" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"stories":{"type":"array"}}}' \
  --append-system-prompt-file /opt/pm-ai/prompts/story-generation.txt \
  --allowedTools "Read"
```

**Warning signs:**
- AI output quality varies between environments (dev vs. server)
- Story generation output changes format between runs without prompt changes
- Queue worker produces different token counts than expected
- Output is not valid JSON despite `--output-format json`

**Phase to address:** Core AI job queue implementation phase (POC foundation). Get this right before any AI feature is built on top.

---

### Pitfall 2: No Human-in-the-Loop Gate on AI-Generated Stories Before They Enter the Workflow

**What goes wrong:**
BA submits a feature description. AI generates user stories with acceptance criteria and story points. Stories are immediately committed to the database and appear on developer boards. Developers start estimating against hallucinated requirements. When the BA reviews them two days later, half the acceptance criteria are fabricated, story points are wildly off, and development has already begun on the wrong interpretation.

**Why it happens:**
The AI output is fast and looks authoritative. Teams assume "it's coming from Claude, it must be right." The review step gets omitted in the interest of automation speed. In enterprise PM contexts, 47% of decisions were made on hallucinated AI content in 2024 (Kanerika research). This is especially dangerous for user stories because they directly define what gets built.

**How to avoid:**
All AI-generated stories must enter a `DRAFT` / `PENDING_REVIEW` state before they are visible to developers. The BA who requested generation must explicitly approve, edit, or reject each story before it transitions to `READY`. The UI should make AI provenance visible — tag each story as "AI Generated" — and prompt the BA to verify acceptance criteria against their original description. Only promote to the active backlog on explicit approval action.

**Warning signs:**
- Stories go directly to `TODO` or `IN_PROGRESS` status on creation
- No audit trail showing who approved an AI-generated story
- Developers reference acceptance criteria that don't match the original feature request
- BA says "I didn't mean it like that" after work is done

**Phase to address:** Story generation feature phase. The `DRAFT` status state must be part of the initial schema — retrofitting it later requires migrating live data.

---

### Pitfall 3: Blueprint Sync Creating Duplicate Records on Retry

**What goes wrong:**
The weekly Blueprint sync job runs. Halfway through, Blueprint's REST API returns a 503. The queue retries the job. Blueprint receives the same batch again. Now every task that was successfully synced in the first run is duplicated in Blueprint. Leadership sees doubled task counts in reporting.

**Why it happens:**
Developers implement sync as a "push all changed records" batch without idempotency keys. Blueprint's API may not deduplicate on its side. Retry logic treats the whole batch as failed rather than tracking per-record success.

**How to avoid:**
Track sync state per record in the PM database: `blueprint_id` (nullable), `last_synced_at`, `sync_status`. Before creating a record in Blueprint, check if `blueprint_id` is already populated — if so, issue a `PUT`/`PATCH` not a `POST`. Use idempotency keys on Blueprint API calls if the API supports them. Process batch syncs record-by-record with individual success/failure tracking, not as an all-or-nothing transaction. On retry, only re-attempt records where `sync_status = FAILED`, not the entire batch.

**Warning signs:**
- Blueprint shows duplicate task names after a sync failure
- Sync job logs show no per-record tracking, only batch-level success/failure
- No `blueprint_id` column in the tasks table
- Retry logic re-queues the entire job rather than individual failed records

**Phase to address:** Blueprint sync implementation phase. The `blueprint_id` tracking column must be in the initial schema migration.

---

### Pitfall 4: Keycloak Token Validation Done Incorrectly on the Backend

**What goes wrong:**
The backend receives a JWT from the frontend and either (a) trusts it without signature verification, (b) validates the signature but skips audience (`aud`) and issuer (`iss`) checks, or (c) uses a hardcoded public key instead of fetching from Keycloak's JWKS endpoint. In case (c), when Keycloak rotates its signing keys (which it does on restart or scheduled rotation), all tokens become permanently invalid until the backend is redeployed.

Additionally: if the Keycloak Frontend URL is not configured, the `iss` claim in tokens will differ depending on whether the request came through a load balancer, internal hostname, or external IP. Token validation will fail intermittently in ways that are impossible to reproduce locally.

**Why it happens:**
JWT validation libraries make it easy to decode without verifying. Developers test with their own token and it works. They don't test key rotation because it's rare. The Keycloak Frontend URL setting is obscure and rarely documented in tutorials.

**How to avoid:**
Use a proper Keycloak adapter library or JWT library that fetches the public key from Keycloak's JWKS endpoint (`/realms/{realm}/protocol/openid-connect/certs`) and caches it with periodic refresh. Validate: signature, `exp`, `iss` (must equal your configured Keycloak realm URL — verify this is the Frontend URL, not the internal hostname), `aud` (must include your client ID). Configure Keycloak's Frontend URL explicitly to a stable, canonical URL that matches what the `iss` claim will be. Reject tokens missing required role claims.

**Warning signs:**
- Auth works on dev but fails on the server intermittently
- Token validation fails after Keycloak restart
- Different `iss` values observed in tokens depending on entry point
- Backend accepts tokens with no audience validation (`aud` not checked)

**Phase to address:** Auth/Keycloak integration phase (POC foundation). Must be correct before any protected endpoints exist.

---

### Pitfall 5: AI Task Auto-Assignment Assuming Static Availability

**What goes wrong:**
The AI assignment engine pulls current task counts per developer and assigns the new task to whoever has the fewest open tasks. It does not account for: PTO/vacation, tasks that are blocked (not actively worked), tasks nearing deadline that will consume full attention, or differences in task complexity (a 1-point task and an 8-point task both count as "1 task"). Developer A gets assigned 12 new tasks while Developer B is on vacation and accumulates a backlog that explodes on their return.

**Why it happens:**
Workload data is easy to quantify (count open tasks). Availability and effective capacity are hard to quantify and require additional data collection (calendars, time logs, story points). Early implementations use the proxy that's easy to measure.

**How to avoid:**
AI assignment must use story points, not task count, as the workload metric. Surface a "capacity flag" concept in the data model from the start: developers can mark themselves as limited availability, and PMs can manually override AI assignments. All AI assignments must be soft suggestions — the PM sees the AI recommendation and approves or changes it before it's committed. Track time-logged vs. estimated on open tasks to detect when a developer's available hours are consumed. Make the AI explain its assignment rationale so reviewers can catch faulty assumptions.

**Warning signs:**
- All tasks go to the most senior developer (most tasks closed historically = AI perceives as most capable)
- Developer on vacation accumulates assigned tasks
- Story point estimation exists but isn't used in assignment logic
- No mechanism for a PM to see "why did AI pick this person?"

**Phase to address:** AI assignment feature phase. Capacity model must be in the data schema before the feature ships — adding it retroactively requires re-training prompts and backfilling data.

---

### Pitfall 6: WebSocket Connections Not Surviving On-Premise Infrastructure (Proxies, Load Balancers)

**What goes wrong:**
Real-time dashboard shows live data in development (direct connection). In production on company servers, real-time stops working. The reverse proxy (nginx, HAProxy, or corporate edge) has a default `proxy_read_timeout` of 60 seconds and kills idle WebSocket connections. Browser clients don't reconnect automatically. Users see stale data and think the app is broken.

**Why it happens:**
WebSocket requires long-lived connections with specific upgrade headers. Corporate on-premise infrastructure often has aggressive timeout policies for security or legacy reasons. Developers test on local machines where no proxy exists.

**How to avoid:**
Configure nginx/proxy with `proxy_read_timeout 3600s`, `proxy_send_timeout 3600s`, and `Upgrade`/`Connection` header pass-through. Implement client-side reconnect logic with exponential backoff (not just a raw WebSocket — use a library with auto-reconnect like `reconnecting-websocket`). Implement server-side heartbeat/ping-pong every 30 seconds to keep connections alive through idle-timeout proxies. If the reverse proxy can't be configured, fall back to SSE (Server-Sent Events) which uses standard HTTP and doesn't require upgrade negotiation. Store WebSocket session state in Redis (not in-process) so reconnecting clients restore their subscription state without server-side memory loss.

**Warning signs:**
- Real-time works in dev, fails in staging/production
- Browser WebSocket connections drop exactly every 60 seconds
- No reconnect logic in the frontend WebSocket client
- Connection state stored in server process memory rather than Redis

**Phase to address:** Real-time infrastructure phase. Test through the actual production proxy configuration before claiming real-time works.

---

### Pitfall 7: POC Scope Creep Making the "Proof" Too Large to Prove Anything

**What goes wrong:**
The POC starts with "prove end-to-end flow." Then leadership asks for role-based dashboards. Then someone wants sprint management. Then notifications. Then full Blueprint sync. The POC takes 4 months. By the time it's done, half the original assumptions are stale, the codebase has accumulated shortcuts that block production refactoring, and the team has forgotten what they were trying to validate.

**Why it happens:**
A working demo creates stakeholder appetite. "Just one more thing" additions are individually small but collectively lethal to POC focus. Internal tools attract everyone's feature requests because "it's just for us, it's fine."

**How to avoid:**
Define the POC success criteria before writing code and hold the line: "One project, one BA generating 3 stories, one developer assigned, one report generated, one sync to Blueprint — end-to-end." Reject any feature that isn't on this critical path. Track POC scope in a visible place (a written document, not verbal agreement). Set a hard timebox (4-6 weeks). If a feature request comes in during POC, log it in a backlog for post-POC phases, don't build it now.

**Warning signs:**
- POC milestone has more than 5-7 features in scope
- New requirements are added without removing old ones
- The word "just" appears in feature requests ("just add notifications")
- POC has been "almost done" for more than 2 weeks

**Phase to address:** POC planning phase (before any code). The scope definition is the prevention — put it in the roadmap success criteria.

---

### Pitfall 8: AI Report Generation Without Data Grounding Produces Confident Nonsense

**What goes wrong:**
The daily report prompt is: "Generate a project status report for the team." Claude generates a plausible-sounding report with risks, milestones, and blockers — but the data isn't injected from the actual database. Or partial data is injected but Claude fills gaps with reasonable-sounding fabrications ("the authentication module appears to be 70% complete"). Leadership reads AI reports and makes decisions on hallucinated project status.

**Why it happens:**
LLMs produce fluent, confident prose regardless of whether the underlying facts are correct. If your prompt doesn't include explicit, structured data, the model fills gaps from its training distribution. Report generation feels "done" because the output looks professional.

**How to avoid:**
Every AI report prompt must inject all factual data explicitly and in structured form (JSON or table format): task counts by status, time logged vs. estimated per developer, overdue tasks by ID, last-updated timestamps, blockers explicitly marked in the database. The prompt must instruct Claude to derive observations only from the provided data and to flag explicitly when data is missing rather than estimating. Validate the output: key metrics in the report (e.g., "8 tasks completed this week") should be verifiable against the database query result that was injected.

**Warning signs:**
- Report prompt does not include a structured data payload
- Reports contain numbers that can't be traced to database queries
- "At risk" flags in reports don't correspond to tasks marked as blockers
- Reports are generated without a system prompt instructing data-grounded behavior

**Phase to address:** AI report generation feature phase. Build prompt validation and data injection as part of the feature, not as a later hardening step.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store WebSocket session state in server memory | Simple, no Redis setup | Server restart drops all subscriptions; can't scale horizontally | Never — use Redis from day one |
| Sync entire Blueprint task list on every run (no change tracking) | No delta logic to write | Doubles sync time with every added task; risks rate limits | POC only if Blueprint task count is under 100 |
| Parse Claude CLI output as plaintext instead of JSON | Faster to implement | Breaks silently when output format changes; no error isolation | Never — always use `--output-format json` |
| Single queue for all AI jobs (story gen, assignment, reports) | Fewer moving parts | Long report jobs block fast story generation requests | POC only; separate queues in production |
| Poll Blueprint for sync confirmation rather than trusting HTTP 200 | Simple | Doubles API calls; Blueprint may not support it | Acceptable if Blueprint has no webhook support |
| Hardcode Keycloak realm URL in config | Simple | Breaks in staging/prod if URL differs; breaks on key rotation | Never — use JWKS endpoint with dynamic config |
| Direct DB queries in WebSocket event handlers | Fast to build | Blocks the event loop; breaks under load | Never — use async DB drivers with connection pooling |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Blueprint REST API | Assuming Blueprint returns the same field names as the PM tool's internal model | Map fields explicitly via a transform layer; never share domain models across the boundary |
| Blueprint REST API | Not tracking `blueprint_id` per record, leading to duplicates on retry | Add `blueprint_id` column to all synced entities in initial schema |
| Blueprint REST API | Treating HTTP 200 as guaranteed success without parsing the response body | Always parse Blueprint response body for partial-failure indicators |
| Keycloak SSO | Validating JWT signature but skipping `iss` and `aud` claims | Validate all claims; configure Keycloak Frontend URL to ensure stable `iss` |
| Keycloak SSO | Caching Keycloak's public key indefinitely | Refresh JWKS keys on a schedule (every 1-5 minutes) to handle key rotation |
| Claude Code CLI | Calling `claude -p` without `--bare` in the queue worker | Always use `--bare` in automated contexts to eliminate environment-dependent behavior |
| Claude Code CLI | Not setting a timeout on the subprocess | Long AI jobs with no timeout will hang the worker indefinitely; set a process timeout |
| Redis (job queue) | Not handling Redis connection failures in the worker | Use connection retry with backoff; dead-letter queue for failed jobs |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Broadcast all WebSocket events to all connected clients | Works fine with 5 users; UI updates feel instant | Room-based subscriptions (subscribe to specific project/task events) | ~50 concurrent users, becomes noisy and causes unnecessary re-renders |
| Single AI worker processing all jobs sequentially | Fine for POC with 3 users | Separate worker pools by job type with priority queues | When story generation (fast) backs up behind report generation (slow) |
| Fetching full task list on every dashboard load | Fast with 20 tasks per project | Paginate and cache; use WebSocket deltas for updates | ~200 tasks per project causes noticeable load times |
| N+1 queries in developer workload calculation | Fast with 3 developers | Batch-load workload data with a single aggregation query | ~10 developers, workload API becomes the slowest endpoint |
| Storing AI job results only in Redis (no persistent record) | Simple, fast | Write job results to DB before returning to caller | If Redis is flushed (restart, memory pressure), all recent AI outputs are lost |
| Blueprint sync as a cron job that blocks during execution | Simple scheduling | Make sync a queue job, store sync state per record, allow parallel partial execution | When Blueprint API has rate limits that exceed the single-job timeout |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Passing user-provided text directly to Claude CLI without sanitization | Prompt injection — a user crafts a task description that hijacks the AI job to exfiltrate data or generate harmful content | Sanitize user input before injection into prompts; use system prompt to establish strict behavioral boundaries; treat AI output as untrusted |
| Exposing Keycloak admin credentials in the backend config | Full realm takeover if config leaks | Backend needs only the realm URL and client ID — never the admin password; use Keycloak's service account with minimum scopes |
| Syncing sensitive internal data (developer notes, risk descriptions) to Blueprint without checking what Blueprint exposes | Internal performance data visible to unintended Blueprint audience | Explicitly define which fields sync to Blueprint; strip internal-only fields at the transform layer |
| Not validating role claims on each API request — only at login | An ex-team-member whose role changed in Keycloak retains access for the duration of their token's TTL | Validate role claims from the JWT on every request; use short token lifetimes (5-15 minutes) with refresh tokens |
| Running Claude Code CLI subprocess with unrestricted `--allowedTools "Bash"` | AI job could execute arbitrary shell commands on the AI server | Restrict `--allowedTools` to the minimum required (typically `Read` only for report/story generation); never allow unrestricted `Bash` in automated context |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| AI story generation shows a loading spinner with no progress indication | BAs wait 15-30 seconds with no feedback, assume it's broken, click generate again (doubles queue load) | Show a queue position indicator or estimated time; acknowledge the job submission immediately with a job ID |
| AI-generated stories appear identical to manually-created ones | BAs don't know which stories need review; developers don't know which acceptance criteria are AI-generated vs. human-written | Tag all AI-generated content with a visible badge; show the original BA input alongside the AI output during review |
| Role-based dashboards show the same dense data to everyone | Developers overwhelmed by PM-level metrics; Leadership can't find the summary they need | Design distinct, purpose-built views per role from day one — not a single view with filtered columns |
| Auto-assignment notification fires before BA approves the story | Developer receives task notification for a story that will change or be rejected | Notifications only fire after all approvals are complete and the task is in `READY` state |
| Report generation with no "last generated" timestamp | Leadership doesn't know if they're reading today's report or last week's | Every AI report must show generation timestamp and the data window it covers |
| Blueprint sync status is invisible to users | When sync fails silently, data in Blueprint is stale and no one knows | Show last-sync timestamp and sync health status on the PM dashboard; surface sync failures as actionable alerts |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **AI Story Generation:** AI produces stories — verify the `DRAFT` approval gate exists, BA must explicitly approve before developers see the stories
- [ ] **Blueprint Sync:** Sync job runs successfully — verify `blueprint_id` is being stored per record and retry behavior is tested with a simulated Blueprint 503
- [ ] **Keycloak Auth:** Login works — verify `iss`, `aud`, and `exp` are validated, not just signature; verify behavior when Keycloak is restarted (key rotation)
- [ ] **Real-Time Dashboard:** Dashboard updates in dev — verify behavior through the actual production reverse proxy with its timeout configuration
- [ ] **AI Task Assignment:** AI recommends a developer — verify the PM must approve before the assignment is committed; verify story points (not task count) drive the recommendation
- [ ] **AI Report Generation:** Report looks good — verify all numbers in the report can be traced to actual DB queries injected into the prompt; no hallucinated metrics
- [ ] **Queue-Based AI Jobs:** Jobs process successfully — verify what happens when the Claude CLI subprocess hangs (timeout), crashes (non-zero exit), or returns malformed JSON
- [ ] **On-Premise Deployment:** App starts on server — verify WebSocket connections survive through the company reverse proxy; verify Redis persists across restarts

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate Blueprint records from failed sync | HIGH | Query Blueprint API to find duplicates; build a dedupe script to merge or delete; add `blueprint_id` tracking to prevent future occurrences; requires Blueprint API write access |
| Stories approved and in-progress with hallucinated acceptance criteria | MEDIUM | BA revisits and manually edits acceptance criteria; retrospective with dev team to catch already-completed work; add the approval gate retroactively |
| Keycloak key rotation breaking all token validation | MEDIUM | Restart backend service (picks up new JWKS); immediate fix is fast, but rotated-key outage window can be hours if undiscovered overnight |
| WebSocket disconnect storm on proxy misconfiguration | LOW | Add proxy timeout config + deploy; clients reconnect within seconds if auto-reconnect is implemented |
| Claude CLI subprocess hanging and blocking queue workers | MEDIUM | Kill hung processes; drain and restart workers; add subprocess timeout to prevent recurrence; implement dead-letter queue for stuck jobs |
| POC scope grew and codebase has production-blocking shortcuts | HIGH | Formal refactoring phase before scaling; audit technical debt explicitly; resist adding features until shortcuts are fixed |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Claude CLI subprocess non-determinism | Core AI queue infrastructure | Worker produces identical output given same input across two different machines |
| Missing human approval gate on AI stories | Story generation feature | Deployed code has no path from AI output to developer board without BA approval action |
| Blueprint sync duplication on retry | Blueprint sync implementation | Simulate Blueprint 503 mid-sync; verify no duplicates appear; verify `blueprint_id` column exists |
| Keycloak JWT validation gaps | Auth/SSO foundation | Validate all claims in automated tests; test Keycloak restart behavior |
| AI assignment using task count not story points | AI assignment feature | Assignment logic references story points; capacity model is in schema |
| WebSocket proxy timeout | Real-time infrastructure | Test through production proxy; verify reconnect survives 60s idle period |
| POC scope creep | POC planning (pre-code) | Written POC success criteria reviewed and approved before any code |
| AI reports with ungrounded data | Report generation feature | Every number in a report is traceable to an explicit DB query in the prompt payload |

---

## Sources

- [Claude Code Headless / Programmatic Usage (Official)](https://code.claude.com/docs/en/headless) — `--bare` flag, `--output-format json`, subprocess behavior
- [Why Claude Code Subagents Waste 50K Tokens Per Turn (DEV Community)](https://dev.to/jungjaehoon/why-claude-code-subagents-waste-50k-tokens-per-turn-and-how-to-fix-it-41ma) — token overhead in subprocess automation
- [Keycloak Token Validation Best Practices (Skycloak)](https://skycloak.io/docs/tutorials/jwt-validation-best-practices/) — JWT claim validation requirements
- [Solving Keycloak Token Validation Issues in Kubernetes (Medium)](https://medium.com/@frankpythagore/solving-keycloak-token-validation-issues-in-kubernetes-a-debugging-journey-d6674be3668f) — inconsistent `iss` claim issue
- [WebSockets at Scale: Architecture for Millions of Connections (WebSocket.org)](https://websocket.org/guides/websockets-at-scale/) — sticky sessions, proxy timeout pitfalls
- [10 WebSocket Scaling Patterns for Real-Time Dashboards (Medium)](https://medium.com/@sparknp1/10-websocket-scaling-patterns-for-real-time-dashboards-1e9dc4681741) — on-premise real-time considerations
- [Overreliance on AI: Risk Identification and Mitigation (Microsoft Learn)](https://learn.microsoft.com/en-us/ai/playbook/technology-guidance/overreliance-on-ai/overreliance-on-ai) — human-in-the-loop necessity
- [AI Hallucinations in Enterprise (Kanerika)](https://kanerika.com/blogs/ai-hallucinations/) — 47% of enterprise AI decisions based on hallucinated content stat
- [Bi-Directional Sync vs CDC Duplicates: Reliability Guide (StackSync)](https://www.stacksync.com/blog/bi-directional-sync-vs-cdc-duplicates-reliability-guide) — idempotency and loop prevention
- [Idempotency in APIs (Medium)](https://medium.com/@mohitmallick/idempotency-in-apis-handling-duplicate-requests-the-right-way-c35d108f98e0) — idempotency key patterns
- [From PoC to Production: Best Practices (Visium)](https://www.visium.com/articles/from-poc-to-production-best-practices-for-deploying-models-and-avoiding-common-pitfalls) — POC-to-production failure modes
- [95% of AI Projects Fail (EveraWe Labs)](https://everawelabs.com/think-it/95-of-ai-projects-fail:-how-to-build-a-2026-ai-roadmap-that-actually-works) — scope and validation failure patterns
- [What AI Still Gets Wrong About Project Management (The Digital PM)](https://thedigitalprojectmanager.com/productivity/what-ai-still-gets-wrong-about-project-management-work/) — domain-specific AI PM limitations

---
*Pitfalls research for: AI-centric project management tool (PM)*
*Researched: 2026-04-05*
