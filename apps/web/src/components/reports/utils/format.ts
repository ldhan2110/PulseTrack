import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

export function formatRange(range?: DateRange): string {
  if (!range?.from) return 'Select period';
  if (!range.to) return format(range.from, 'dd/MM/yyyy');
  return `${format(range.from, 'dd/MM/yyyy')} – ${format(range.to, 'dd/MM/yyyy')}`;
}
