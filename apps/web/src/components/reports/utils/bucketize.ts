import { format, getISOWeek, getISOWeekYear, startOfISOWeek, endOfISOWeek } from 'date-fns';
import type { ReportColumn, TimesheetRow } from '@/lib/types';
import type { GroupBy } from './presets';

// Group daily columns into day/week/month buckets and sum each row's values per bucket.
// Daily data is already in the browser, so week/month views are just adjacent days summed.
// `days` and every `values[]` are index-aligned: values[i] is the hours on days[i].
export function bucketize(
  days: Date[],
  rows: TimesheetRow[],
  groupBy: GroupBy,
): { columns: ReportColumn[]; rows: TimesheetRow[] } {
  // bucket key per day index; identity for 'day'
  const keyOf = (d: Date): string => {
    if (groupBy === 'week') return `${getISOWeekYear(d)}-W${getISOWeek(d)}`;
    if (groupBy === 'month') return format(d, 'yyyy-MM');
    return format(d, 'yyyy-MM-dd');
  };

  // ordered bucket keys + the day indices falling in each
  const order: string[] = [];
  const members = new Map<string, number[]>();
  days.forEach((d, i) => {
    const k = keyOf(d);
    if (!members.has(k)) {
      members.set(k, []);
      order.push(k);
    }
    members.get(k)!.push(i);
  });

  const columns: ReportColumn[] = order.map((k) => {
    const idxs = members.get(k)!;
    const first = days[idxs[0]];
    if (groupBy === 'week') {
      // week columns span under their month
      return { key: k, label: `W${getISOWeek(first)}`, sublabel: `${format(startOfISOWeek(first), 'MMM d')}–${format(endOfISOWeek(first), 'd')}`, group: format(first, 'MMM yyyy') };
    }
    if (groupBy === 'month') {
      // month columns span under their year
      return { key: k, label: format(first, 'MMM'), group: format(first, 'yyyy') };
    }
    // day columns span under their month
    return { key: k, label: format(first, 'd'), sublabel: format(first, 'EEE'), group: format(first, 'MMM yyyy') };
  });

  const sumBuckets = (values: number[]): number[] =>
    order.map((k) => members.get(k)!.reduce((s, i) => s + (values[i] ?? 0), 0));

  const outRows: TimesheetRow[] = rows.map((row) => ({
    ...row,
    values: sumBuckets(row.values),
    // total unchanged: sum across all days == sum across all buckets
    tickets: row.tickets.map((t) => ({ ...t, values: sumBuckets(t.values) })),
  }));

  return { columns, rows: outRows };
}
