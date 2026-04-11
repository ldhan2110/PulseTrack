/**
 * Compute averaged progress for a parent task from its children.
 * Returns 0 if no children exist.
 */
export function getParentProgress(children: { progress?: number }[]): number {
  if (children.length === 0) return 0;
  const sum = children.reduce((acc, c) => acc + (c.progress ?? 0), 0);
  return Math.round(sum / children.length);
}
