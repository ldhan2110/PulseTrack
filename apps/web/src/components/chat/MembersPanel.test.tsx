// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Conversation } from '../../lib/types';

const searchResults: any[] = [];
vi.mock('@/hooks/useChat', () => ({
  useSearchChatTargets: () => ({ data: searchResults }),
  useAddChatMembers: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveChatMember: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { MembersPanel } from './MembersPanel';

function conv(myRole: 'owner' | 'member'): Conversation {
  return {
    id: 'c1',
    type: 'CHANNEL',
    name: 'eng-team',
    members: [
      { userId: 'me', role: myRole, user: { id: 'me', name: 'Me', username: 'me', imageUrl: null } },
      { userId: 'u2', role: 'member', user: { id: 'u2', name: 'Bob', username: 'bob', imageUrl: null } },
    ],
  } as unknown as Conversation;
}

beforeEach(() => {
  searchResults.length = 0;
});

describe('MembersPanel', () => {
  it('non-owner sees no remove control', async () => {
    render(<MembersPanel conversation={conv('member')} myId="me" />);
    fireEvent.click(screen.getByLabelText('View members'));
    await waitFor(() => screen.getByText('Members · 2'));
    expect(screen.queryByLabelText(/^Remove /)).toBeNull();
  });

  it('owner sees a remove control on other members', async () => {
    render(<MembersPanel conversation={conv('owner')} myId="me" />);
    fireEvent.click(screen.getByLabelText('View members'));
    await waitFor(() => expect(screen.getByLabelText('Remove Bob')).toBeTruthy());
  });

  it('add search filters out existing members', async () => {
    searchResults.push(
      { id: 'u2', name: 'Bob', username: 'bob', imageUrl: null }, // already a member
      { id: 'u9', name: 'Cara', username: 'cara', imageUrl: null }, // not a member
    );
    render(<MembersPanel conversation={conv('owner')} myId="me" />);
    fireEvent.click(screen.getByLabelText('View members'));
    await waitFor(() => screen.getByPlaceholderText('Add people by name or username'));
    fireEvent.change(
      screen.getByPlaceholderText('Add people by name or username'),
      { target: { value: 'ca' } },
    );
    // Cara is offered to add; Bob (existing member) is not in the add list
    await waitFor(() => expect(screen.getByText('Cara')).toBeTruthy());
    // Bob appears only once (member row), never as an add suggestion
    expect(screen.getAllByText('Bob')).toHaveLength(1);
  });
});
