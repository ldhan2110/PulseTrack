// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Message } from '../../lib/types';

vi.mock('./MessageAttachment', () => ({ MessageAttachment: () => null }));
vi.mock('./ReactionBar', () => ({ ReactionBar: () => null }));

import { MessageRow } from './MessageRow';

function row(body: string, myId = 'me') {
  const m = { id: 'm1', conversationId: 'c1', body, author: { id: 'a', name: 'A', username: 'a' } } as unknown as Message;
  return render(
    <MessageRow
      message={m}
      own={false}
      isEditing={false}
      myId={myId}
      onStartEdit={() => {}}
      onCancelEdit={() => {}}
      onCommitEdit={() => {}}
      onRequestDelete={() => {}}
    />,
  );
}

describe('MessageRow mention render', () => {
  it('renders a mention token as a colored bold span', () => {
    row('hey @[Bob](u2) there');
    const span = screen.getByText('@Bob');
    expect(span.tagName).toBe('SPAN');
    expect(span.className).toContain('font-semibold');
    expect(span.getAttribute('data-mention')).toBe('other');
  });

  it('marks an own-mention and adds the bubble left-border', () => {
    const { container } = row('@[Me](me) ping', 'me');
    const span = screen.getByText('@Me');
    expect(span.getAttribute('data-mention')).toBe('me');
    // bubble gets a left-border accent
    expect(container.querySelector('[class*="border-l-"]')).toBeTruthy();
  });

  it('leaves a plain @word as plain text (no token span)', () => {
    row('hey @bob no markup');
    expect(screen.queryByText('@bob')).toBeNull();
    // whole body present as plain text
    expect(screen.getByText('hey @bob no markup')).toBeTruthy();
  });
});
