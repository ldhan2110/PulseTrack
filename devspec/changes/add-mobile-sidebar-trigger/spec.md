# Spec: add-mobile-sidebar-trigger

### Requirement: mobile sidebar trigger [req-1]
The web app SHALL expose a sidebar-open control in the `ProjectLayout` top bar
on viewports below 768px, and SHALL hide it at or above 768px.

Follows: shadcn `SidebarTrigger` + `useIsMobile` (768px breakpoint,
`hooks/use-mobile.ts`); Tailwind `md:hidden` visibility convention.

#### Scenario: trigger visible on mobile
- **WHEN** the viewport width is below 768px
- **THEN** a hamburger trigger is visible in the top bar, left of the notification bell

#### Scenario: trigger opens the drawer
- **WHEN** the viewport is below 768px and the user activates the trigger
- **THEN** the off-canvas sidebar drawer opens

#### Scenario: trigger hidden on desktop
- **WHEN** the viewport width is 768px or wider
- **THEN** the hamburger trigger is not rendered/visible (desktop uses the in-sidebar collapse control)
