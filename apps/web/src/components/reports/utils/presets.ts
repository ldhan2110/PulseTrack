import type { DateRange } from 'react-day-picker';
import {
  subWeeks,
  subMonths,
  startOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

export type GroupBy = 'day' | 'week' | 'month';

// Preset ranges shown as quick-select radios under the Period control.
export const PRESETS: { label: string; getRange: () => DateRange }[] = [
  { label: 'This week', getRange: () => ({ from: startOfWeek(startOfToday(), { weekStartsOn: 1 }), to: endOfWeek(startOfToday(), { weekStartsOn: 1 }) }) },
  { label: 'Last week', getRange: () => ({ from: startOfWeek(subWeeks(startOfToday(), 1), { weekStartsOn: 1 }), to: endOfWeek(subWeeks(startOfToday(), 1), { weekStartsOn: 1 }) }) },
  { label: 'Current month', getRange: () => ({ from: startOfMonth(startOfToday()), to: endOfMonth(startOfToday()) }) },
  { label: 'Last month', getRange: () => ({ from: startOfMonth(subMonths(startOfToday(), 1)), to: endOfMonth(subMonths(startOfToday(), 1)) }) },
];
