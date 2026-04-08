import { describe, it, expect } from 'vitest';
import { extractMentionedUserIds } from './mention-extractor';

describe('extractMentionedUserIds', () => {
  it('extracts user IDs from mention spans', () => {
    const html = '<p>Hey <span data-mention-id="user1" class="mention">@Alice</span> and <span data-mention-id="user2" class="mention">@Bob</span></p>';
    expect(extractMentionedUserIds(html)).toEqual(['user1', 'user2']);
  });

  it('returns empty array when no mentions', () => {
    expect(extractMentionedUserIds('<p>No mentions here</p>')).toEqual([]);
  });

  it('deduplicates user IDs', () => {
    const html = '<p><span data-mention-id="user1">@Alice</span> and again <span data-mention-id="user1">@Alice</span></p>';
    expect(extractMentionedUserIds(html)).toEqual(['user1']);
  });

  it('handles empty string', () => {
    expect(extractMentionedUserIds('')).toEqual([]);
  });
});
