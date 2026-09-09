import { useEffect, useRef, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { Member } from '@/lib/types';
import { PRESETS } from './utils/presets';
import { formatRange } from './utils/format';

interface CriteriaFilterProps {
  projectId: string;
  range?: DateRange;
  preset: string | null;
  selectedTypes: string[];
  members: Member[];
  userIds: string[];
  onRangeChange: (r: DateRange | undefined) => void;
  onPreset: (label: string, r: DateRange) => void;
  onToggleType: (typeId: string) => void;
  onSetTypes: (ids: string[]) => void;
  onToggleUser: (userId: string) => void;
  onReset: () => void;
}

export function CriteriaFilter({ projectId, range, preset, selectedTypes, members, userIds, onRangeChange, onPreset, onToggleType, onSetTypes, onToggleUser, onReset }: CriteriaFilterProps) {
  const [userOpen, setUserOpen] = useState(false);
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onReset();
            onSetTypes(activeTypes.map((t) => t.id));
          }}
        >
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

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Members</label>
          <Popover open={userOpen} onOpenChange={setUserOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={userOpen}
                className="w-full justify-between font-normal"
              >
                <span className="truncate text-sm">
                  {userIds.length === 0 ? 'All users' : `${userIds.length} user${userIds.length === 1 ? '' : 's'}`}
                </span>
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search members..." />
                <CommandList className="max-h-60 overflow-y-auto">
                  <CommandEmpty>No members found.</CommandEmpty>
                  <CommandGroup>
                    {members.map((m) => {
                      const label = m.user.name ?? m.user.username;
                      const initials = label.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                      return (
                        <CommandItem key={m.userId} value={label} onSelect={() => onToggleUser(m.userId)}>
                          <Check className={cn('mr-2 size-4', userIds.includes(m.userId) ? 'opacity-100' : 'opacity-0')} />
                          <Avatar className="size-5 mr-1.5">
                            {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} alt={label} />}
                            <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
            <div className="flex max-h-79 flex-col gap-0.5 overflow-y-auto rounded-md border bg-muted/30 p-2">
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
