// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { FieldConfig } from '@/lib/fieldConfig';

const mutate = vi.fn();
let fieldConfig: FieldConfig | null = null;

vi.mock('@/hooks/useTasks', () => ({
  useCreateTask: () => ({ mutate, isPending: false }),
}));
vi.mock('@/hooks/useProjects', () => ({
  useProject: () => ({ data: { id: 'p1', fieldConfig } }),
}));
vi.mock('@/lib/api', () => ({
  api: {
    getTaskTypes: () => Promise.resolve([{ id: 't1', name: 'Bug', isActive: true }]),
    getTaskCategories: () => Promise.resolve([{ id: 'c1', name: 'Design', isActive: true }]),
  },
}));

import { CreateTaskDialog } from './CreateTaskDialog';

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <CreateTaskDialog open onOpenChange={() => {}} projectId="p1" members={[]} sprints={[]} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mutate.mockClear();
  fieldConfig = null;
});

describe('CreateTaskDialog field visibility', () => {
  it('unset config renders all 5 in-dialog fields', () => {
    renderDialog();
    for (const label of ['Story Points', 'Ticket Type', 'Priority', 'Assignee', 'Sprint']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('hidden sprint is not rendered', () => {
    fieldConfig = { sprint: false };
    renderDialog();
    expect(screen.queryByText('Sprint')).toBeNull();
    expect(screen.getByText('Ticket Type')).toBeTruthy();
  });

  it('both required selects hidden lets submit succeed with no required error', async () => {
    fieldConfig = { taskType: false, taskCategory: false };
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Task title'), { target: { value: 'My task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Ticket type is required')).toBeNull();
    expect(screen.queryByText('Task type is required')).toBeNull();
    expect(mutate.mock.calls[0][0].taskTypeId).toBeUndefined();
    expect(mutate.mock.calls[0][0].taskCategoryId).toBeUndefined();
  });

  it('visible taskType blocks submit when empty', async () => {
    fieldConfig = null;
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Task title'), { target: { value: 'My task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));
    await waitFor(() => expect(screen.getByText('Ticket type is required')).toBeTruthy());
    expect(mutate).not.toHaveBeenCalled();
  });

  it('renders the Task Type field when visible, hides it when configured off', () => {
    fieldConfig = null;
    const { unmount } = renderDialog();
    expect(screen.getByText('Task Type')).toBeTruthy();
    unmount();

    fieldConfig = { taskCategory: false };
    renderDialog();
    expect(screen.queryByText('Task Type')).toBeNull();
    expect(screen.getByText('Ticket Type')).toBeTruthy();
  });

  it('visible taskCategory blocks submit when empty', async () => {
    fieldConfig = { taskType: false }; // isolate: only Task type required
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Task title'), { target: { value: 'My task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));
    await waitFor(() => expect(screen.getByText('Task type is required')).toBeTruthy());
    expect(mutate).not.toHaveBeenCalled();
  });
});
