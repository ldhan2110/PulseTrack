# UI: add-agent-write-consent

**Mockups**: `mockups/create-token-modal.html` (approved 2026-09-18)
**References**: sibling of existing `apps/web/src/components/settings/McpAccessCard.tsx` create-token dialog
**Style source**: shadcn tokens from `apps/web/src/index.css` (`--primary`, `--muted`, `--destructive`, `--border`, `--radius`); Tailwind 4 per `apps/web/src` conventions

## create-token modal (McpAccessCard dialog)

Single screen — the existing "Create MCP token" dialog gains one consent block below the Scopes grid.

Layout:
```
┌─ Create MCP token ─────────────────────┐
│ Label   [ Claude Desktop — laptop    ] │
│ Scopes                                  │
│   ☑ tasks:read     ☑ bugs:read          │
│   ☑ tasks:write    ☐ tasks:logtime      │
│   ☐ tasks:attach   ☐ testcases:read …   │
│ ┌─ consent ────────────────────────────┐│
│ │ ☐ Allow this agent to write data as me││
│ │   create/update/log on your behalf.   ││
│ │   Write scopes inactive until on.     ││
│ └───────────────────────────────────────┘│
│ ⚠ tasks:write selected but consent off  │  ← only when write scope ticked + consent off
│ Expires (optional) [ ____-__-__ ]       │
│              [ Cancel ]  [ Create ]     │
└─────────────────────────────────────────┘
```

States:
- **default / consent OFF** — box unchecked. If any write scope is ticked, show destructive warning banner ("… will be rejected until you allow it").
- **consent ON** — box checked, no warning.
- **submitting** — inputs + buttons disabled, spinner in Create.
- **error** — destructive banner "Failed to create token." (existing behavior, unchanged).

Interactions:
- Checkbox toggles `allowWrite` in the create payload. Independent of scope checkboxes (does not auto-tick scopes).
- Warning banner is advisory only — does not block Create (a read-only-consent token is valid).
- Create disabled unless label non-empty and ≥1 scope (existing rule, unchanged).

Components (reuse, real `path:symbol`):
- `<Checkbox>` — `apps/web/src/components/ui/checkbox.tsx` (same as scope checkboxes)
- `<Label>` — `apps/web/src/components/ui/label.tsx`
- Warning banner — reuse the existing destructive `<div>` style already in `McpAccessCard.tsx:267` (`border-destructive/50 bg-destructive/10`)
- All inside the existing `<Dialog>` (`apps/web/src/components/ui/dialog.tsx`)
