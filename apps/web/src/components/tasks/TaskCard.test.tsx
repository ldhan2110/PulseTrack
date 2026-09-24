// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Task } from '../../lib/types';
import { TaskCard } from './TaskCard';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    taskKey: 'CARIS-142',
    title: 'Refactor auth middleware token expiry check',
    taskType: { name: 'Bug' },
    assignee: { id: 'u1', name: 'An Le', username: 'anle' },
    priority: 'HIGH',
    storyPoints: 5,
    plannedEndDate: '2030-01-01',
    workflowStatus: { isClosed: false },
    project: { id: 'p1', name: 'Caris', prefix: 'CARIS' },
    ...overrides,
  } as unknown as Task;
}

describe('TaskCard', () => {
  it('renders key, title, type, assignee, and priority', () => {
    render(<TaskCard task={makeTask()} statusControl={<span>To Do</span>} />);
    expect(screen.getByText('CARIS-142')).toBeTruthy();
    expect(screen.getByText('Refactor auth middleware token expiry check')).toBeTruthy();
    expect(screen.getByText('Bug')).toBeTruthy();
    expect(screen.getByText('AL')).toBeTruthy(); // assignee initials
    expect(screen.getByTitle('High')).toBeTruthy(); // priority icon
    expect(screen.getByText('To Do')).toBeTruthy(); // status control slot
  });

  it('shows the points chip only when showPoints is set', () => {
    const { rerender, container } = render(<TaskCard task={makeTask()} />);
    expect(screen.queryByText('5')).toBeNull();
    rerender(<TaskCard task={makeTask()} showPoints />);
    expect(container.textContent).toContain('5');
  });

  it('shows the project chip only when showProject is set', () => {
    const { rerender } = render(<TaskCard task={makeTask()} />);
    expect(screen.queryByText('CARIS')).toBeNull();
    rerender(<TaskCard task={makeTask()} showProject />);
    expect(screen.getByText('CARIS')).toBeTruthy();
  });

  it('applies the overdue top border for a past, not-closed task', () => {
    const { container } = render(
      <TaskCard task={makeTask({ plannedEndDate: '2020-01-01', workflowStatus: { isClosed: false } as Task['workflowStatus'] })} />,
    );
    expect(container.querySelector('.border-t-red-500')).toBeTruthy();
  });

  it('does not mark overdue when the task is closed', () => {
    const { container } = render(
      <TaskCard task={makeTask({ plannedEndDate: '2020-01-01', workflowStatus: { isClosed: true } as Task['workflowStatus'] })} />,
    );
    expect(container.querySelector('.border-t-red-500')).toBeNull();
  });

  it('hides fields turned off in fieldConfig', () => {
    render(
      <TaskCard
        task={makeTask()}
        showPoints
        fieldConfig={{ taskType: false, assignee: false, priority: false, plannedEndDate: false, storyPoints: false }}
      />,
    );
    expect(screen.getByText('CARIS-142')).toBeTruthy(); // key always shows
    expect(screen.queryByText('Bug')).toBeNull(); // taskType hidden
    expect(screen.queryByText('AL')).toBeNull(); // assignee hidden
    expect(screen.queryByTitle('High')).toBeNull(); // priority hidden
    expect(screen.queryByText('5')).toBeNull(); // story points hidden
  });
});
