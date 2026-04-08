export function extractMentionedUserIds(html: string): string[] {
  const regex = /data-mention-id="([^"]+)"/g;
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}
