# UI: sidebar-permission-gating

No new visual design — this only hides/shows existing `PROJECT_NAV_ITEMS` in the
left sidebar based on the current role's `view` permissions. Same styling,
icons, spacing, active-state, and collapsed behavior as today.

## Behavior
Each item renders only when its mapped area's `view` is granted; parent "Project
Planner" collapses out when both its children are hidden.

## States (example: role with bugs.view=off, wiki.view=off, planner+wbs=off)

```
FULL (system/admin)        GATED (restricted member)
┌──────────────────┐       ┌──────────────────┐
│ Dashboard        │       │ Dashboard        │
│ ▸ Project Planner│       │ Backlog          │   ← Project Planner gone
│   Scope Def.     │       │ Sprints          │      (both children denied)
│   WBS            │       │ Test Cases       │
│ Backlog          │       │ Test Executions  │
│ Sprints          │       │ Reports          │   ← Bugs gone
│ Test Cases       │       │ Members & Groups │   ← Wiki gone
│ Test Executions  │       │ Settings         │
│ Bugs             │       └──────────────────┘
│ Reports          │
│ Members & Groups │       Loading (role unresolved):
│ Wiki             │       gated items hidden (fail closed),
│ Settings         │       resolve → correct set appears.
└──────────────────┘
```

Untouched: top-level My Tasks, Chat, project switcher, profile/footer.
Collapsed (icon-only) sidebar shows the same reduced set.
