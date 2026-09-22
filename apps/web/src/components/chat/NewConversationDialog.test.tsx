// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const PEOPLE = [
  { id: 'alice', name: 'Alice', username: 'alice', imageUrl: null },
  { id: 'bob', name: 'Bob', username: 'bob', imageUrl: null },
];
const createMutate = vi.fn();

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'me' } }),
}));

// stateful mock: useSearchChatTargets filters by the query the component passes in
vi.mock('@/hooks/useChat', () => ({
  useSearchChatTargets: (query: string) => ({
    data: PEOPLE.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
  }),
  useConversations: () => ({ data: [] }),
  useCreateConversation: () => ({ mutate: createMutate }),
}));

import { NewConversationDialog } from './NewConversationDialog';
import { useUiStore } from '@/store/uiStore';

beforeEach(() => {
  createMutate.mockClear();
  useUiStore.setState({
    chatOverlayOpen: true,
    activeProjectId: 'p1',
    activeConversationId: null,
  });
});

describe('NewConversationDialog', () => {
  it('filters people as the user types', () => {
    render(<NewConversationDialog />);
    // both visible initially (empty query matches all) — narrow to Alice
    fireEvent.change(screen.getByPlaceholderText('Search people'), {
      target: { value: 'ali' },
    });
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bob')).toBeNull();
  });

  it('starts a DM via createChatConversation when a person row is clicked', () => {
    render(<NewConversationDialog />);
    fireEvent.change(screen.getByPlaceholderText('Search people'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getAllByText('Alice')[0]);
    expect(createMutate).toHaveBeenCalledWith(
      { type: 'DM', memberIds: ['alice'] },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
