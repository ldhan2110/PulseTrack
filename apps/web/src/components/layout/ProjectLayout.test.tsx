// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// jsdom lacks matchMedia; use-mobile + SidebarProvider call it.
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

// Isolate the top bar: stub the heavy children/side-effect hooks so the test
// covers ProjectLayout's own trigger wiring, not the whole app tree.
const isMobile = vi.fn(() => true);
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => isMobile() }));
vi.mock('./AppSidebar', () => ({ AppSidebar: () => <div data-testid="app-sidebar" /> }));
vi.mock('@/components/notifications/NotificationBell', () => ({ NotificationBell: () => <div /> }));
vi.mock('../projects/CreateProjectDialog', () => ({ CreateProjectDialog: () => null }));
vi.mock('@/hooks/useProjects', () => ({ useProjectByPrefix: () => ({ data: undefined }) }));
vi.mock('@/hooks/useMembershipSync', () => ({ useMembershipSync: () => {} }));
vi.mock('@/hooks/useTaskSync', () => ({ useTaskSync: () => {} }));
vi.mock('@/hooks/useNotifications', () => ({ useNotificationSync: () => {} }));

import { ProjectLayout } from './ProjectLayout';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/projects/ABC/dashboard']}>
      <Routes>
        <Route path="/projects/:projectPrefix/*" element={<ProjectLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectLayout mobile sidebar trigger [req-1]', () => {
  it('renders the trigger, hidden on desktop via md:hidden', () => {
    const trigger = renderLayout().getByLabelText('Open sidebar');
    expect(trigger).toBeTruthy();
    // md:hidden = present on mobile, hidden ≥768px (CSS, not computed in jsdom)
    expect(trigger.className).toContain('md:hidden');
  });

  it('activating the trigger toggles the sidebar without error', () => {
    renderLayout();
    // toggleSidebar (SidebarProvider) runs on click; a throw would fail here.
    expect(() => fireEvent.click(screen.getAllByLabelText('Open sidebar')[0])).not.toThrow();
  });
});
