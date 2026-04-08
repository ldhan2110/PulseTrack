import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColumnFiltersState } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BugSeverity, Member } from '@/lib/types';
import { useWorkflow } from '@/hooks/useWorkflow';

const SEVERITY_OPTIONS: { value: BugSeverity; label: string }[] = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface BugFiltersProps {
  projectId: string;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: (filters: ColumnFiltersState) => void;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  members: Member[];
}

export function BugFilters({
  projectId,
  columnFilters,
  onColumnFiltersChange,
  globalFilter,
  onGlobalFilterChange,
  members,
}: BugFiltersProps) {
  const { data: workflow } = useWorkflow(projectId, 'BUG');
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

  const getFilterValue = useCallback(
    (id: string) => columnFilters.find((f) => f.id === id)?.value,
    [columnFilters],
  );

  const setFilterValue = useCallback(
    (id: string, value: unknown) => {
      const updated = columnFilters.filter((f) => f.id !== id);
      if (value !== undefined) {
        updated.push({ id, value });
      }
      onColumnFiltersChange(updated);
    },
    [columnFilters, onColumnFiltersChange],
  );

  const selectedSeverities = (getFilterValue('severity') as BugSeverity[] | undefined) ?? [];
  const selectedStatuses = (getFilterValue('workflowStatusId') as string[] | undefined) ?? [];
  const selectedAssignees = (getFilterValue('assigneeId') as string[] | undefined) ?? [];

  const hasAnyFilter =
    selectedSeverities.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedAssignees.length > 0 ||
    searchValue !== '';

  const clearAllFilters = () => {
    onColumnFiltersChange([]);
    setSearchValue('');
    onGlobalFilterChange('');
  };

  const toggleSeverity = (severity: BugSeverity) => {
    const current = [...selectedSeverities];
    const idx = current.indexOf(severity);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(severity);
    setFilterValue('severity', current.length > 0 ? current : undefined);
  };

  const toggleStatus = (statusId: string) => {
    const current = [...selectedStatuses];
    const idx = current.indexOf(statusId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(statusId);
    setFilterValue('workflowStatusId', current.length > 0 ? current : undefined);
  };

  const toggleAssignee = (userId: string) => {
    const current = [...selectedAssignees];
    const idx = current.indexOf(userId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(userId);
    setFilterValue('assigneeId', current.length > 0 ? current : undefined);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search bugs..."
          value={searchValue}
          onChange={handleSearchChange}
          className="pl-8 h-8 w-[200px] text-sm"
        />
      </div>

      {/* Severity filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-8 gap-1.5', selectedSeverities.length > 0 && 'border-primary')}
          >
            Severity
            {selectedSeverities.length > 0 && (
              <Badge variant="secondary" className="size-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                {selectedSeverities.length}
              </Badge>
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col gap-1">
            {SEVERITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted text-sm"
              >
                <Checkbox
                  checked={selectedSeverities.includes(opt.value)}
                  onCheckedChange={() => toggleSeverity(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Status filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-8 gap-1.5', selectedStatuses.length > 0 && 'border-primary')}
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
            {(workflow?.statuses ?? []).map((ws) => (
              <label
                key={ws.id}
                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted text-sm"
              >
                <Checkbox
                  checked={selectedStatuses.includes(ws.id)}
                  onCheckedChange={() => toggleStatus(ws.id)}
                />
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: ws.color }} />
                {ws.name}
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Assignee filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-8 gap-1.5', selectedAssignees.length > 0 && 'border-primary')}
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
