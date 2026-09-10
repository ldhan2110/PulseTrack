# Proposal: add-mobile-sidebar-trigger

## Why
On viewports below 768px the shadcn sidebar primitive (`components/ui/sidebar.tsx`)
correctly swaps `AppSidebar` from an inline `collapsible="icon"` rail to an
off-canvas `<Sheet>`, which starts closed. But every control that opens it
(`SidebarCollapseButton`, the logo `onClick={toggleSidebar}`) lives *inside*
that drawer. Closed drawer → no reachable trigger → the sidebar is effectively
gone on mobile.

## What it delivers
A hamburger trigger in the `ProjectLayout` top bar, visible only on mobile,
that opens the existing drawer. Uses the primitive's built-in `SidebarTrigger`
(already calls `toggleSidebar`, which flips `openMobile` on mobile). No new
responsive logic — the breakpoint, the Sheet, and the width are already built
into shadcn.

## Scope

In:
- Add `SidebarTrigger` to the `ProjectLayout` top bar (`ProjectLayout.tsx:53`),
  shown `md:hidden`, positioned left of the existing `NotificationBell`.

Out:
- Desktop collapse/expand behavior — unchanged, works.
- Drawer width / mobile nav layout — shadcn default (`18rem`) is adequate.
- Any route outside `ProjectLayout` — verified the sidebar mounts only there,
  so one trigger is total coverage.
