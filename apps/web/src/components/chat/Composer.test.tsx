// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ConversationMember } from '../../lib/types';

const sendMutate = vi.fn();
vi.mock('@/hooks/useChat', () => ({
  useSendMessage: () => ({ mutate: sendMutate }),
  useMarkChatRead: () => ({ mutate: vi.fn() }),
  chatKeys: { messages: (id: string) => ['m', id], conversations: ['c'] },
}));
vi.mock('@/socket/instance', () => ({
  getChatSocket: () => ({ emit: vi.fn() }),
}));
vi.mock('@/lib/api', () => ({ api: { uploadChatAttachment: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { Composer } from './Composer';

const members: ConversationMember[] = [
  { userId: 'u2', role: 'member', user: { id: 'u2', name: 'Alice', username: 'alice', imageUrl: null } },
  { userId: 'u3', role: 'member', user: { id: 'u3', name: 'Bob', username: 'bob', imageUrl: null } },
] as unknown as ConversationMember[];

beforeEach(() => sendMutate.mockClear());

describe('Composer @mention', () => {
  it('filters members on @a, inserts on click, sends token body', async () => {
    render(<Composer conversationId="c1" members={members} />);
    const ta = screen.getByPlaceholderText(/Type a message/) as HTMLTextAreaElement;

    fireEvent.change(ta, { target: { value: '@a', selectionStart: 2 } });

    // dropdown lists Alice (matches 'a'); Bob does not
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
    expect(screen.queryByText('Bob')).toBeNull();

    fireEvent.click(screen.getByText('Alice'));

    // inserted plain @Alice into the field
    await waitFor(() => expect(ta.value).toContain('@Alice'));

    fireEvent.keyDown(ta, { key: 'Enter' });

    expect(sendMutate).toHaveBeenCalledTimes(1);
    expect(sendMutate.mock.calls[0][0].body).toBe('@[Alice](u2)');
  });
});
