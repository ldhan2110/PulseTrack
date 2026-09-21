// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageThreadView } from './MessageThread';
import type { Message } from '@/lib/types';

const mai = { id: 'u2', username: 'mai', email: 'm@x.y', name: 'Mai Khanh', imageUrl: null };

function m(id: string, extra: Partial<Message> = {}): Message {
  return {
    id,
    conversationId: 'c1',
    authorId: 'u2',
    author: mai,
    body: `msg ${id}`,
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-09-21T10:00:00.000Z',
    attachments: [],
    ...extra,
  };
}

describe('MessageThreadView', () => {
  it('renders one avatar + name for a run of consecutive same-author messages', () => {
    const messages = [
      m('1', { createdAt: '2026-09-21T10:00:00.000Z' }),
      m('2', { createdAt: '2026-09-21T10:01:00.000Z' }),
      m('3', { createdAt: '2026-09-21T10:02:00.000Z' }),
    ];
    render(<MessageThreadView messages={messages} myId="me" />);

    // name shown once for the whole group
    expect(screen.getAllByText('Mai Khanh')).toHaveLength(1);
    // all three bubbles present
    expect(screen.getByText('msg 1')).toBeTruthy();
    expect(screen.getByText('msg 2')).toBeTruthy();
    expect(screen.getByText('msg 3')).toBeTruthy();
  });

  it('renders a deleted message as a placeholder with no body', () => {
    const messages = [
      m('1', { deletedAt: '2026-09-21T10:05:00.000Z', body: 'secret' }),
    ];
    render(<MessageThreadView messages={messages} myId="me" />);

    expect(screen.getByTestId('deleted-placeholder').textContent).toContain(
      'message deleted',
    );
    expect(screen.queryByText('secret')).toBeNull();
  });
});
