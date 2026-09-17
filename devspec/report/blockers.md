
## add-project-chat — section 1 (1.4 apply migration) — 2026-09-17

**Type:** hard-block case 1 (destructive/irreversible on shared dev DB)

**What:** Migration file `apps/api/prisma/migrations/20260917000000_add_project_chat/migration.sql` is written and correct (enum + Conversation/ConversationMember/Message + FKs + partial unique index). `prisma generate` succeeded. Applying it (`migrate deploy`) fails P3018.

**Why blocked:** The live shared dev DB (`10.0.0.85:5439/pm_x`) already contains **leftover objects from the abandoned chat attempt** that `db.md`/task 1.1 assumed were inert/never applied:
- `ConversationType` enum — exists → `CREATE TYPE` collides (`42710 type already exists`).
- `Message` table — exists with a **different shape** (extra `editedAt`, `deletedAt` cols; FK only on `senderId`, none on `conversationId`) **and holds 2 real rows** (`<p>Hello how are you</p>`, `<p>HELLO HOW ARE YOU</p>` @ 2026-09-11).
- `Conversation`, `ConversationMember` — missing.

To make my (correct) migration apply, the pre-existing `Message` table + `ConversationType` enum must be dropped first — `DROP TABLE "Message"` destroys 2 data rows. Per worker rules that's a destructive op I must not run autonomously.

Separately: the DB migration history already diverged before this change (`20260904100000_planner_message_proposal` applied but absent from `prisma/migrations/`), so `migrate dev` demands a full destructive reset.

**Needs a human to decide one of:**
1. Drop the stale `Message` table + `ConversationType` enum (confirm the 2 rows are throwaway test data), then re-run the worker → `migrate deploy` applies cleanly.
2. Or reconcile via `prisma migrate resolve` / a hand-written idempotent migration that adapts the existing `Message` table (adds `conversationId` FK, drops extra cols) instead of recreating it — if those 2 rows must be preserved.
3. Also resolve the pre-existing `planner_message_proposal` history divergence.

**Done in this change (file work, committed):** 1.1 (dead dir already absent), 1.2 (schema models landed), 1.3 (partial index in migration file). Only 1.4 (apply) is blocked. Sections 2–6 depend on the Prisma client types from a clean apply, so the change is stopped here.
