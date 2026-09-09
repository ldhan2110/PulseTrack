import { useEffect, useRef } from 'react';
import type { DateRange } from 'react-day-picker';
import { CalendarIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PRESETS } from './utils/presets';
import { formatRange } from './utils/format';

interface CriteriaFilterProps {
  projectId: string;
  range?: DateRange;
  preset: string | null;
  selectedTypes: string[];
  onRangeChange: (r: DateRange | undefined) => void;
  onPreset: (label: string, r: DateRange) => void;
  onToggleType: (typeId: string) => void;
  onSetTypes: (ids: string[]) => void;
  onReset: () => void;
}

export function CriteriaFilter({ projectId, range, preset, selectedTypes, onRangeChange, onPreset, onToggleType, onSetTypes, onReset }: CriteriaFilterProps) {
  const { data: taskTypes = [] } = useQuery({
    queryKey: ['task-types', projectId],
    queryFn: () => api.getTaskTypes(projectId),
    enabled: !!projectId,
  });
  const activeTypes = taskTypes.filter((t) => t.isActive);

  // Seed all types as selected once, when they first load.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && activeTypes.length > 0) {
      seeded.current = true;
      onSetTypes(activeTypes.map((t) => t.id));
    }
  }, [activeTypes, onSetTypes]);

  const allChecked = activeTypes.length > 0 && selectedTypes.length === activeTypes.length;
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

        {activeTypes.length > 0 && (
          <fieldset className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Task Types</label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={() => onSetTypes(allChecked ? [] : activeTypes.map((t) => t.id))}
                />
                All
              </label>
            </div>
            <div className="flex flex-col gap-0.5 overflow-y-auto rounded-md border bg-muted/30 p-2">
              {activeTypes.map((tt) => (
                <label
                  key={tt.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
                >
                  <Checkbox
                    checked={selectedTypes.includes(tt.id)}
                    onCheckedChange={() => onToggleType(tt.id)}
                  />
                  {tt.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </CardContent>
    </Card>
  );
}
