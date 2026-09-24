// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const updateMutate = vi.fn();

vi.mock('@/hooks/useProjects', () => ({
  useUpdateProject: () => ({ mutate: updateMutate, isPending: false }),
}));
vi.mock('@/lib/api', () => ({
  api: {
    getTaskTypes: () => Promise.resolve([{ id: 't1', name: 'Bug', isActive: true }]),
    getTaskCategories: () => Promise.resolve([{ id: 'c1', name: 'Design', isActive: true }]),
    setTaskTypes: vi.fn(() => Promise.resolve([])),
    setTaskCategories: vi.fn(() => Promise.resolve([])),
  },
}));

import { ConfigureFieldsDialog } from './ConfigureFieldsDialog';

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ConfigureFieldsDialog open onOpenChange={() => {}} projectId="p1" fieldConfig={null} />
    </QueryClientProvider>,
  );
}

beforeEach(() => updateMutate.mockClear());

describe('ConfigureFieldsDialog', () => {
  it('required fields default ON but can be toggled off (hidable)', () => {
    renderDialog();
    const ticket = document.getElementById('field-taskType') as HTMLButtonElement;
    const task = document.getElementById('field-taskCategory') as HTMLButtonElement;
    expect(ticket).toBeTruthy();
    expect(ticket.getAttribute('data-state')).toBe('checked');
    expect(ticket).not.toBeDisabled();
    expect(task).not.toBeDisabled();
    fireEvent.click(ticket);
    expect(ticket.getAttribute('data-state')).toBe('unchecked');
  });

  it('expanding Task type reveals its inline value editor', async () => {
    renderDialog();
    fireEvent.click(screen.getByText('Task type'));
    expect(await screen.findByRole('button', { name: 'Add task type' })).toBeTruthy();
  });

  it('empty active value name disables that section Save and shows an error', async () => {
    renderDialog();
    fireEvent.click(screen.getByText('Task type'));
    const input = (await screen.findByDisplayValue('Design')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });

    await waitFor(() =>
      expect(screen.getByText('Active values cannot have empty names.')).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: 'Save task type' })).toBeDisabled();
  });

  it('Save visibility is blocked while a value section is dirty', async () => {
    renderDialog();
    fireEvent.click(screen.getByText('Task type'));
    const input = (await screen.findByDisplayValue('Design')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Design 2' } });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save visibility' })).toBeDisabled(),
    );
  });
});
