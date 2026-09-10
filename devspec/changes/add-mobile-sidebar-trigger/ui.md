# UI: add-mobile-sidebar-trigger

## ProjectLayout top bar

Mobile (<768px):
  ┌────────────────────────────┐
  │ [☰]                  [🔔]  │
  └────────────────────────────┘
    tap ☰ → sidebar drawer slides in from left (shadcn Sheet)

Desktop (≥768px):
  ┌────────────────────────────┐
  │                      [🔔]  │   no ☰ — sidebar is inline,
  └────────────────────────────┘   collapse control lives in it

Component: `<SidebarTrigger className="md:hidden" />` (from `@/components/ui/sidebar`)
Placement: `ProjectLayout.tsx:53` top-bar div — change `justify-end` → `justify-between`
           so ☰ sits left, 🔔 stays right. On desktop ☰ is hidden, 🔔 stays right.

States: none (stateless button). Drawer open/close state owned by SidebarProvider (`openMobile`).
Interactions: activate ☰ → `toggleSidebar()` → drawer opens. Tap scrim / nav item → drawer closes (shadcn default).
