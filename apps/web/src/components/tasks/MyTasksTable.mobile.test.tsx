// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Task } from '../../lib/types';

let mobile = true;
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mobile }));
vi.mock('@/hooks/useMyTasks', () => ({ useDeleteMyTask: () => ({ mutate: vi.fn() }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

import { MyTasksTable } from './MyTasksTable';

function makeTask(): Task {
  return {
    id: 't1', taskKey: 'CARIS-1', title: 'Cross-project task', projectId: 'p1',
    project: { id: 'p1', name: 'Caris', prefix: 'CARIS' },
    workflowStatus: { id: 's1', name: 'To Do', color: '#94a3b8', isClosed: false },
    taskType: { name: 'Task' }, assignee: null, priority: 'LOW',
  } as unknown as Task;
}

describe('MyTasksTable responsive', () => {
  beforeEach(() => { mobile = true; });

  it('renders stacked cards with a project chip on mobile, no table', () => {
    render(<MyTasksTable tasks={[makeTask()]} />);
    expect(screen.getByText('Cross-project task')).toBeTruthy();
    expect(screen.getByText('CARIS')).toBeTruthy(); // project chip
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows the empty message when there are no tasks', () => {
    render(<MyTasksTable tasks={[]} />);
    expect(screen.getByText('No tasks assigned to you')).toBeTruthy();
  });
});
