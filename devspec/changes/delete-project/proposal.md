# Proposal: delete-project

## Why
A project owner needs a way to remove a project that is no longer wanted. Today the only lifecycle action is **archive** (perm-gated, in-app restore, hides from the active list). There is no "delete" — and archive is the wrong tool for "this project should be gone", because any member with `projectSettings:update` can archive/unarchive, and it stays fully visible under the archived view.

## What it delivers
A **soft delete** for projects:
- A new **Danger Zone** in Project Settings → General, visible **only to the project owner**.
- Deleting sets `Project.deletedAt`; the project then disappears from **every** member's lists and becomes unreachable (detail + nested reads 404), owner included.
- A scary confirm dialog (project name, admin-only-recovery warning) guards the action.
- Recovery is **DB-only by an administrator** — no in-app undelete.

## How it differs from archive (kept, untouched)
| | Archive (exists) | Delete (this change) |
|---|---|---|
| Gate | `projectSettings:update` permission | **owner only** (`ownerId === caller`) |
| Visibility | hidden from active list, shown in archived view | hidden from everyone, no view |
| Restore | in-app unarchive button | admin, via DB only |
| Intent | "shelve, come back later" | "gone" |
| Confirm | none | warning AlertDialog |

## Scope

**In**
- `Project.deletedAt` column (nullable) + additive migration.
- `DELETE /projects/:projectId` — owner-guarded, sets `deletedAt`.
- Exclude soft-deleted projects from `findAllForUser` and `findOne` (404).
- Owner-only Danger Zone card + confirm dialog + delete hook in `ProjectSettingsPage`.

**Out**
- In-app restore / "deleted projects" admin view — recovery is DB-only.
- Cascading soft-delete onto children (tasks/bugs/etc.) — hidden transitively; not flagged.
- Hard delete / purge.
- Changing archive behavior.
- Ownerless projects — `ownerId` is `NOT NULL`, every project always has an owner.
