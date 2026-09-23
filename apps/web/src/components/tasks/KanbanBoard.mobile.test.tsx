// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Task } from '../../lib/types';

// Force mobile
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));
// Sentinel for the desktop column path — must NOT render on mobile
vi.mock('./KanbanColumn', () => ({ KanbanColumn: () => <div data-testid="kcol" /> }));
// Stub the radix dropdown shell so items are plain always-rendered buttons (real guard still runs)
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect, disabled }: { children: React.ReactNode; onSelect?: () => void; disabled?: boolean }) => (
    <button disabled={disabled} onClick={() => onSelect?.()}>{children}</button>
  ),
}));

const mutate = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }));
vi.mock('@/hooks/useTasks', () => ({ useUpdateTask: () => ({ mutate }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock('@/hooks/useWorkflow', () => ({
  useWorkflow: () => ({
    data: {
      statuses: [
        { id: 's1', name: 'To Do', color: '#94a3b8', key: 'TODO', position: 0, isClosed: false },
        { id: 's2', name: 'Done', color: '#22c55e', key: 'DONE', position: 1, isClosed: true },
      ],
      transitions: [], // no allowed transitions → s1→s2 is disallowed
    },
  }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

import { KanbanBoard } from './KanbanBoard';

function makeTask(): Task {
  return {
    id: 't1', taskKey: 'CARIS-1', title: 'A task', workflowStatusId: 's1',
    taskType: { name: 'Task' }, assignee: null, priority: 'LOW',
  } as unknown as Task;
}

describe('KanbanBoard mobile', () => {
  beforeEach(() => { mutate.mockClear(); toastError.mockClear(); });

  it('renders status sections, not the desktop DndContext columns', () => {
    render(<KanbanBoard tasks={[makeTask()]} projectId="p1" projectPrefix="CARIS" />);
    // status section headers
    expect(screen.getAllByText('To Do').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0);
    // desktop column path did not render
    expect(screen.queryByTestId('kcol')).toBeNull();
  });

  it('blocks a disallowed status move: no mutate, shows error', () => {
    render(<KanbanBoard tasks={[makeTask()]} projectId="p1" projectPrefix="CARIS" />);
    // "Done" appears as a section header and as a move-menu item; the item is the button
    const doneItem = screen.getAllByText('Done').map((el) => el.closest('button')).find(Boolean) as HTMLButtonElement;
    fireEvent.click(doneItem);
    expect(mutate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('This status transition is not allowed');
  });
});
