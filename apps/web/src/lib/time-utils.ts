/** Format minutes into human-readable duration: "2h 30m", "45m", "1h" */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Calculate total estimated minutes for a task (auto-sum from children if parent) */
export function getTotalEstimated(task: { estimatedMinutes?: number | null; children?: { estimatedMinutes?: number | null }[] }): number {
  if (task.children && task.children.length > 0) {
    return task.children.reduce((sum, c) => sum + (c.estimatedMinutes ?? 0), 0);
  }
  return task.estimatedMinutes ?? 0;
}

/** Calculate total logged minutes for a task (auto-sum from children if parent) */
export function getTotalLogged(task: { timeLogs?: { minutes: number }[]; children?: { timeLogs?: { minutes: number }[] }[] }): number {
  if (task.children && task.children.length > 0) {
    return task.children.reduce((sum, c) => {
      const childLogged = c.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;
      return sum + childLogged;
    }, 0);
  }
  return task.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;
}
