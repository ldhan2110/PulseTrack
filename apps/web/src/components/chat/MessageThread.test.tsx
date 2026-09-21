// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

// grouping/deleted are what this suite verifies; ReactionBar pulls auth+query providers
vi.mock('./ReactionBar', () => ({ ReactionBar: () => null }));
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessageThreadView } from './MessageThread';
import type { Message } from '@/lib/types';

function renderView(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

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
    renderView((<MessageThreadView messages={messages} myId="me" />));

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
    renderView((<MessageThreadView messages={messages} myId="me" />));

    expect(screen.getByTestId('deleted-placeholder').textContent).toContain(
      'has deleted this message',
    );
    expect(screen.queryByText('secret')).toBeNull();
  });
});
