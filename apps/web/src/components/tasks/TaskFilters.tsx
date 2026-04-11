import { useEffect, useRef, useState } from 'react';
import type { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, WorkflowStatus, Member, Sprint } from '@/lib/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface TaskFiltersProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: Table<Task>;
  members: Member[];
  sprints: Sprint[];
  workflowStatuses?: WorkflowStatus[];
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
}

export function TaskFilters({
  table,
  members,
  sprints,
  workflowStatuses = [],
  globalFilter,
  onGlobalFilterChange,
}: TaskFiltersProps) {
  const [searchValue, setSearchValue] = useState(globalFilter);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onGlobalFilterChange(val);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const statusColumn = table.getColumn('workflowStatusId');
  const assigneeColumn = table.getColumn('assigneeId');
  const sprintColumn = table.getColumn('sprintId');
  const progressColumn = table.getColumn('progress');

  const selectedStatuses = (statusColumn?.getFilterValue() as string[] | undefined) ?? [];
  const selectedAssignees = (assigneeColumn?.getFilterValue() as string[] | undefined) ?? [];
  const selectedSprint = (sprintColumn?.getFilterValue() as string | undefined) ?? '';
  const selectedProgress = (progressColumn?.getFilterValue() as string[] | undefined) ?? [];

  const hasAnyFilter =
    selectedStatuses.length > 0 ||
    selectedAssignees.length > 0 ||
    selectedSprint !== '' ||
    selectedProgress.length > 0 ||
    searchValue !== '';

  const clearAllFilters = () => {
    statusColumn?.setFilterValue(undefined);
    assigneeColumn?.setFilterValue(undefined);
    sprintColumn?.setFilterValue(undefined);
    progressColumn?.setFilterValue(undefined);
    setSearchValue('');
    onGlobalFilterChange('');
  };

  const toggleStatus = (statusId: string) => {
    const current = [...selectedStatuses];
    const idx = current.indexOf(statusId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(statusId);
    statusColumn?.setFilterValue(current.length > 0 ? current : undefined);
  };

  const toggleAssignee = (userId: string) => {
    const current = [...selectedAssignees];
    const idx = current.indexOf(userId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(userId);
    assigneeColumn?.setFilterValue(current.length > 0 ? current : undefined);
  };

  const selectSprint = (sprintId: string) => {
    sprintColumn?.setFilterValue(sprintId === '' ? undefined : sprintId);
  };

  const toggleProgress = (range: string) => {
    const current = [...selectedProgress];
    const idx = current.indexOf(range);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(range);
    progressColumn?.setFilterValue(current.length > 0 ? current : undefined);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search tasks..."
          value={searchValue}
          onChange={handleSearchChange}
          className="pl-8 h-8 w-[200px] text-sm"
        />
      </div>

      {/* Status filter */}
      {workflowStatuses.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 gap-1.5',
                selectedStatuses.length > 0 && 'border-primary',
              )}
            >
              Status
              {selectedStatuses.length > 0 && (
                <Badge variant="secondary" className="size-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                  {selectedStatuses.length}
                </Badge>
              )}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="flex flex-col gap-1">
              {workflowStatuses.map((ws) => (
                <label
                  key={ws.id}
                  className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted text-sm"
                >
                  <Checkbox
                    checked={selectedStatuses.includes(ws.id)}
                    onCheckedChange={() => toggleStatus(ws.id)}
                  />
                  <span
                    className="inline-block size-2 rounded-full shrink-0"
                    style={{ backgroundColor: ws.color }}
                  />
                  {ws.name}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Assignee filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1.5',
              selectedAssignees.length > 0 && 'border-primary',
            )}
          >
            Assignee
            {selectedAssignees.length > 0 && (
              <Badge variant="secondary" className="size-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                {selectedAssignees.length}
              </Badge>
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted text-sm">
              <Checkbox
                checked={selectedAssignees.includes('unassigned')}
                onCheckedChange={() => toggleAssignee('unassigned')}
              />
              <span className="text-muted-foreground">Unassigned</span>
            </label>
            {members.map((member) => (
              <label
                key={member.userId}
                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted text-sm"
              >
                <Checkbox
                  checked={selectedAssignees.includes(member.userId)}
                  onCheckedChange={() => toggleAssignee(member.userId)}
                />
                <Avatar className="size-5">
                  {member.user.imageUrl && <AvatarImage src={member.user.imageUrl} alt={member.user.name ?? member.user.username} />}
                  <AvatarFallback className="text-[9px]">
                    {getInitials(member.user.name ?? member.user.username)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{member.user.name ?? member.user.username}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Sprint filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1.5',
              selectedSprint !== '' && 'border-primary',
            )}
          >
            Sprint
            {selectedSprint !== '' && (
              <Badge variant="secondary" className="size-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                1
              </Badge>
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => selectSprint('')}
              className={cn(
                'flex items-center rounded px-2 py-1.5 hover:bg-muted text-sm text-left w-full',
                selectedSprint === '' && 'font-medium',
              )}
            >
              All sprints
            </button>
            <button
              type="button"
              onClick={() => selectSprint('none')}
              className={cn(
                'flex items-center rounded px-2 py-1.5 hover:bg-muted text-sm text-left w-full text-muted-foreground',
                selectedSprint === 'none' && 'font-medium text-foreground',
              )}
            >
              No Sprint
            </button>
            {sprints.map((sprint) => (
              <button
                key={sprint.id}
                type="button"
                onClick={() => selectSprint(sprint.id)}
                className={cn(
                  'flex items-center rounded px-2 py-1.5 hover:bg-muted text-sm text-left w-full truncate',
                  selectedSprint === sprint.id && 'font-medium',
                )}
              >
                {sprint.name}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Progress filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1.5',
              selectedProgress.length > 0 && 'border-primary',
            )}
          >
            Progress
            {selectedProgress.length > 0 && (
              <Badge variant="secondary" className="size-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                {selectedProgress.length}
              </Badge>
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-2" align="start">
          <div className="flex flex-col gap-1">
            {[
              { value: '0', label: '0%' },
              { value: '1-49', label: '1–49%' },
              { value: '50-99', label: '50–99%' },
              { value: '100', label: '100%' },
            ].map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted text-sm"
              >
                <Checkbox
                  checked={selectedProgress.includes(opt.value)}
                  onCheckedChange={() => toggleProgress(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear filters */}
      {hasAnyFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-muted-foreground"
          onClick={clearAllFilters}
        >
          <X className="size-3.5" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// Custom filter functions for use with TanStack Table
export const statusFilterFn = (row: { getValue: (id: string) => unknown }, columnId: string, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  return filterValue.includes(row.getValue(columnId) as string);
};

export const assigneeFilterFn = (row: { getValue: (id: string) => unknown }, columnId: string, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const val = row.getValue(columnId) as string | null;
  if (filterValue.includes('unassigned') && (val === null || val === undefined)) return true;
  if (val && filterValue.includes(val)) return true;
  return false;
};

export const sprintFilterFn = (row: { getValue: (id: string) => unknown }, columnId: string, filterValue: string) => {
  if (!filterValue) return true;
  const val = row.getValue(columnId) as string | null;
  if (filterValue === 'none') return val === null || val === undefined;
  return val === filterValue;
};

export const progressFilterFn = (row: { getValue: (id: string) => unknown }, columnId: string, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const val = (row.getValue(columnId) as number) ?? 0;
  return filterValue.some((range) => {
    switch (range) {
      case '0': return val === 0;
      case '1-49': return val >= 1 && val <= 49;
      case '50-99': return val >= 50 && val <= 99;
      case '100': return val === 100;
      default: return true;
    }
  });
};
