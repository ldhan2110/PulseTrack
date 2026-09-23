// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Task } from '../../lib/types';

let mobile = true;
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mobile }));
vi.mock('@/hooks/useTasks', () => ({ useUpdateTaskStatus: () => ({ mutate: vi.fn() }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
// TaskFilters is desktop-only chrome with its own deps — stub it out
vi.mock('./TaskFilters', () => ({
  TaskFilters: () => null,
  statusFilterFn: () => true,
  assigneeFilterFn: () => true,
  sprintFilterFn: () => true,
  progressFilterFn: () => true,
  matchesFilters: () => true,
}));

import { TasksTable } from './TasksTable';

function makeTask(): Task {
  return {
    id: 't1', taskKey: 'CARIS-1', title: 'Mobile card task', workflowStatusId: 's1',
    workflowStatus: { id: 's1', name: 'To Do', color: '#94a3b8', isClosed: false },
    taskType: { name: 'Task' }, assignee: null, priority: 'LOW', storyPoints: 3,
  } as unknown as Task;
}

function renderTable() {
  return render(
    <TasksTable tasks={[makeTask()]} projectId="p1" projectPrefix="CARIS" members={[]} sprints={[]} workflowStatuses={[]} />,
  );
}

describe('TasksTable responsive', () => {
  beforeEach(() => { mobile = true; });

  it('renders stacked cards (no table) on mobile', () => {
    renderTable();
    expect(screen.getByText('Mobile card task')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders the tanstack table on desktop', () => {
    mobile = false;
    renderTable();
    expect(screen.getByRole('table')).toBeTruthy();
  });
});
