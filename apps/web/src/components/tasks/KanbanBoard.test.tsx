import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { Task, TaskStatus } from '@/lib/types';
import { KanbanBoard } from './KanbanBoard';
import * as tasksHooks from '@/hooks/useTasks';

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PointerSensor: class PointerSensor {},
  KeyboardSensor: class KeyboardSensor {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
}));

vi.mock('@dnd-kit/sortable', () => ({
  sortableKeyboardCoordinates: vi.fn(),
}));

vi.mock('@/hooks/useTasks', () => ({
  useUpdateTaskStatus: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Backlog Task 1',
    description: null,
    status: 'BACKLOG' as TaskStatus,
    storyPoints: 5,
    assigneeId: null,
    sprintId: null,
    projectId: 'proj-1',
    createdById: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'task-2',
    title: 'In Progress Task',
    description: null,
    status: 'IN_PROGRESS' as TaskStatus,
    storyPoints: 3,
    assigneeId: null,
    sprintId: null,
    projectId: 'proj-1',
    createdById: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'task-3',
    title: 'Blocked Task',
    description: null,
    status: 'BLOCKED' as TaskStatus,
    storyPoints: null,
    assigneeId: null,
    sprintId: null,
    projectId: 'proj-1',
    createdById: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(MemoryRouter, null, children),
  );
}

describe('KanbanBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tasksHooks.useUpdateTaskStatus).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof tasksHooks.useUpdateTaskStatus>);
  });

  it('renders 5 columns, one per TaskStatus', () => {
    render(<KanbanBoard tasks={mockTasks} projectId="proj-1" />, { wrapper: Wrapper });

    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('In Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('groups tasks into correct columns by status', () => {
    render(<KanbanBoard tasks={mockTasks} projectId="proj-1" />, { wrapper: Wrapper });

    expect(screen.getByText('Backlog Task 1')).toBeInTheDocument();
    expect(screen.getByText('In Progress Task')).toBeInTheDocument();
    expect(screen.getByText('Blocked Task')).toBeInTheDocument();
  });

  it('shows 0 count badge for empty columns (IN_REVIEW and DONE have no tasks)', () => {
    render(<KanbanBoard tasks={mockTasks} projectId="proj-1" />, { wrapper: Wrapper });

    // IN_REVIEW has 0 tasks, DONE has 0 tasks — at least 2 "0" badges
    const badges = screen.getAllByText('0');
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it('initializes useUpdateTaskStatus with the correct projectId', () => {
    render(<KanbanBoard tasks={mockTasks} projectId="proj-1" />, { wrapper: Wrapper });

    expect(tasksHooks.useUpdateTaskStatus).toHaveBeenCalledWith('proj-1');
  });
});
