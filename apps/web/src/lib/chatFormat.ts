import type { Message } from './types';

export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

/** Google Chat–style day label: Today / Yesterday / weekday / date. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = (today.getTime() - d.getTime()) / 86_400_000;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

/** Consecutive same-author messages within the window form one group. */
export function groupMessages(messages: Message[]): Message[][] {
  const groups: Message[][] = [];
  for (const m of messages) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (
      prev &&
      prev.authorId === m.authorId &&
      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <
        GROUP_WINDOW_MS
    ) {
      last.push(m);
    } else {
      groups.push([m]);
    }
  }
  return groups;
}
