import { describe, it, expect } from 'vitest';
import { upsertReactions, toggleReactionLocal } from './reactions.util';
import { groupReactions, reactorNames } from '../components/chat/ReactionBar';
import type { MessageReaction } from '../lib/types';

const page = (msgs: any[]) => ({ pages: [{ items: msgs, nextCursor: null }], pageParams: [undefined] });
const u = { id: 'u1', name: 'Al', username: 'al', email: 'a@a', imageUrl: null } as any;

describe('reactions util', () => {
  it('upsertReactions replaces the reactions of the target message only', () => {
    const data = page([{ id: 'm1', reactions: [] }, { id: 'm2', reactions: [] }]);
    const rx: MessageReaction[] = [{ id: 'r1', messageId: 'm1', emoji: '👍', userId: 'u1', user: u }];
    const out = upsertReactions(data as any, 'm1', rx);
    expect(out.pages[0].items[0].reactions).toEqual(rx);
    expect(out.pages[0].items[1].reactions).toEqual([]);
  });

  it('upsertReactions preserves reference identity for non-matching updates', () => {
    const data = page([{ id: 'm1', reactions: [] }, { id: 'm2', reactions: [] }]);
    const rx: MessageReaction[] = [{ id: 'r1', messageId: 'missing-id', emoji: '👍', userId: 'u1', user: u }];
    const out = upsertReactions(data as any, 'missing-id', rx);
    expect(out).toBe(data);

    const originalPage = data.pages[0];
    const originalM2 = data.pages[0].items[1];
    const matched = upsertReactions(data as any, 'm1', rx);
    expect(matched).not.toBe(data);
    expect(matched.pages[0]).not.toBe(originalPage);
    expect(matched.pages[0].items[1]).toBe(originalM2);
  });

  it('toggleReactionLocal adds then removes my emoji', () => {
    const data = page([{ id: 'm1', reactions: [] }]);
    const added = toggleReactionLocal(data as any, 'm1', '👍', u);
    expect(added.pages[0].items[0].reactions).toHaveLength(1);
    const removed = toggleReactionLocal(added as any, 'm1', '👍', u);
    expect(removed.pages[0].items[0].reactions).toHaveLength(0);
  });

  it('groups by emoji and formats reactor names', () => {
    const rx: any = [
      { emoji: '👍', userId: 'u1', user: { name: 'Al' } },
      { emoji: '👍', userId: 'u2', user: { name: 'Bo' } },
    ];
    expect(groupReactions(rx)).toHaveLength(1);
    expect(reactorNames(rx, 'u1')).toBe('you and Bo');
  });
});
