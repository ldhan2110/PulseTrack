import type { DateRange } from 'react-day-picker';
import { CalendarIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { PRESETS } from './utils/presets';
import { formatRange } from './utils/format';

interface CriteriaFilterProps {
  range?: DateRange;
  preset: string | null;
  onRangeChange: (r: DateRange | undefined) => void;
  onPreset: (label: string, r: DateRange) => void;
  onReset: () => void;
}

export function CriteriaFilter({ range, preset, onRangeChange, onPreset, onReset }: CriteriaFilterProps) {
  return (
    <Card className="h-full rounded-none border-0 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Criteria</CardTitle>
        <Button variant="outline" size="sm" onClick={onReset}>
          Reset
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Period</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start whitespace-nowrap font-normal">
                <CalendarIcon className="mr-2 size-4" />
                {formatRange(range)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="range" selected={range} onSelect={onRangeChange} numberOfMonths={2} />
            </PopoverContent>
          </Popover>
          <fieldset className="mt-2 flex flex-col gap-1.5">
            <label className="text-sm font-medium">Date Range</label>
            {PRESETS.map((p) => (
              <label key={p.label} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="period-preset"
                  className="size-4 accent-primary"
                  checked={preset === p.label}
                  onChange={() => onPreset(p.label, p.getRange())}
                />
                {p.label}
              </label>
            ))}
          </fieldset>
        </div>
      </CardContent>
    </Card>
  );
}
