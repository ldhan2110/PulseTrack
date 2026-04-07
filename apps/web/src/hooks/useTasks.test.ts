import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { Task } from '../lib/types';
import * as apiModule from '../lib/api';

vi.mock('../lib/api');

const mockApi = vi.mocked(apiModule.api);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const mockTask: Task = {
  id: 'task-1',
  taskKey: null,
  title: 'Test Task',
  description: null,
  workflowStatusId: null,
  storyPoints: null,
  assigneeId: null,
  sprintId: null,
  projectId: 'proj-1',
  createdById: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('useTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls api.getTasks with the correct projectId and returns data', async () => {
    const { useTasks } = await import('./useTasks');
    mockApi.getTasks = vi.fn().mockResolvedValue([mockTask]);

    const { result } = renderHook(() => useTasks('proj-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.getTasks).toHaveBeenCalledWith('proj-1');
    expect(result.current.data).toEqual([mockTask]);
  });

  it('calls api.createTask and invalidates the tasks query on success', async () => {
    const { useCreateTask } = await import('./useTasks');
    const newTask: Task = { ...mockTask, id: 'task-2', title: 'New Task' };
    mockApi.createTask = vi.fn().mockResolvedValue(newTask);

    const { result } = renderHook(() => useCreateTask('proj-1'), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ title: 'New Task' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.createTask).toHaveBeenCalledWith('proj-1', { title: 'New Task' });
  });

  it('useUpdateTaskStatus performs optimistic update on the tasks query cache', async () => {
    const { useUpdateTaskStatus } = await import('./useTasks');

    mockApi.updateTask = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ...mockTask, workflowStatusId: 'ws-in-progress' }), 100)),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Pre-populate the cache with existing tasks
    queryClient.setQueryData<Task[]>(['tasks', 'proj-1'], [mockTask]);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result: mutationResult } = renderHook(() => useUpdateTaskStatus('proj-1'), {
      wrapper,
    });

    // Fire mutation — onMutate will optimistically update the cache
    mutationResult.current.mutate({ taskId: 'task-1', workflowStatusId: 'ws-in-progress' });

    // Optimistic update should be reflected in cache before API resolves
    await waitFor(() => {
      const cachedTasks = queryClient.getQueryData<Task[]>(['tasks', 'proj-1']);
      expect(cachedTasks?.find((t) => t.id === 'task-1')?.workflowStatusId).toBe('ws-in-progress');
    });
  });

  it('calls api.deleteTask and invalidates the tasks query on success', async () => {
    const { useDeleteTask } = await import('./useTasks');
    mockApi.deleteTask = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteTask('proj-1'), {
      wrapper: createWrapper(),
    });

    result.current.mutate('task-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.deleteTask).toHaveBeenCalledWith('proj-1', 'task-1');
  });
});
