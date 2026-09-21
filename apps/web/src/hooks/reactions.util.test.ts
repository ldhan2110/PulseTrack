import { describe, it, expect } from 'vitest';
import { upsertReactions, toggleReactionLocal } from './reactions.util';
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

  it('toggleReactionLocal adds then removes my emoji', () => {
    const data = page([{ id: 'm1', reactions: [] }]);
    const added = toggleReactionLocal(data as any, 'm1', '👍', u);
    expect(added.pages[0].items[0].reactions).toHaveLength(1);
    const removed = toggleReactionLocal(added as any, 'm1', '👍', u);
    expect(removed.pages[0].items[0].reactions).toHaveLength(0);
  });
});
