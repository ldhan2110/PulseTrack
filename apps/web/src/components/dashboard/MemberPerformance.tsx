import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MemberPerformanceRow } from '@/lib/types';

type SortKey = 'name' | 'completed' | 'hours' | 'avgHours' | 'quality' | 'bugs';
type SortDir = 'asc' | 'desc';

interface MemberPerformanceProps {
  members: MemberPerformanceRow[];
  teamAvgHoursPerTask: number;
  timeFilter: string;
  onTimeFilterChange: (value: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function QualityBlocks({ ratio }: { ratio: number }) {
  let filled: number;
  let color: string;

  if (ratio === 0) {
    filled = 5;
    color = '#22c55e';
  } else if (ratio < 0.1) {
    filled = 4;
    color = '#22c55e';
  } else if (ratio < 0.25) {
    filled = 3;
    color = '#22c55e';
  } else if (ratio < 0.5) {
    filled = 2;
    color = '#f59e0b';
  } else {
    filled = 1;
    color = '#ef4444';
  }

  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-6 w-2 rounded-sm"
          style={{ backgroundColor: i < filled ? color : 'hsl(var(--muted))' }}
        />
      ))}
    </div>
  );
}

function TaskBar({ completed, inProgress, todo }: { completed: number; inProgress: number; todo: number }) {
  const total = completed + inProgress + todo;
  if (total === 0) {
    return <div className="h-5 w-full rounded bg-muted" />;
  }

  return (
    <div>
      <div className="flex h-5 overflow-hidden rounded" style={{ gap: '1px' }}>
        {completed > 0 && (
          <div
            style={{ width: `${(completed / total) * 100}%`, backgroundColor: '#22c55e' }}
            title={`Done: ${completed}`}
          />
        )}
        {inProgress > 0 && (
          <div
            style={{ width: `${(inProgress / total) * 100}%`, backgroundColor: '#3b82f6' }}
            title={`In Progress: ${inProgress}`}
          />
        )}
        {todo > 0 && (
          <div
            style={{ width: `${(todo / total) * 100}%`, backgroundColor: 'hsl(var(--muted-foreground) / 0.3)' }}
            title={`To Do: ${todo}`}
          />
        )}
      </div>
      <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
        <span><span className="text-green-500">●</span> {completed} done</span>
        <span><span className="text-blue-500">●</span> {inProgress} active</span>
        <span><span className="text-muted-foreground">●</span> {todo} todo</span>
      </div>
    </div>
  );
}

function TrendArrow({ avgHours, teamAvg }: { avgHours: number; teamAvg: number }) {
  if (avgHours === 0 || teamAvg === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Lower avg hours per task = more efficient = green up arrow
  const isBetter = avgHours <= teamAvg;

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-medium">{avgHours.toFixed(1)}h</span>
      <svg width="12" height="12" viewBox="0 0 12 12">
        {isBetter ? (
          <path d="M6 2 L10 8 L2 8 Z" fill="#22c55e" />
        ) : (
          <path d="M6 10 L10 4 L2 4 Z" fill="#ef4444" />
        )}
      </svg>
    </div>
  );
}

const AVATAR_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#10b981', '#f97316', '#8b5cf6'];

function compareMembersByKey(a: MemberPerformanceRow, b: MemberPerformanceRow, key: SortKey): number {
  switch (key) {
    case 'name': return a.name.localeCompare(b.name);
    case 'completed': return (a.tasks?.completed ?? 0) - (b.tasks?.completed ?? 0);
    case 'hours': return (Number(a.hoursLogged) || 0) - (Number(b.hoursLogged) || 0);
    case 'avgHours': return (Number(a.avgHoursPerTask) || 0) - (Number(b.avgHoursPerTask) || 0);
    case 'quality': return (Number(a.qualityRatio) || 0) - (Number(b.qualityRatio) || 0);
    case 'bugs': return (Number(a.bugCount) || 0) - (Number(b.bugCount) || 0);
    default: return 0;
  }
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (column !== sortKey) return <ArrowUpDown className="ml-1 inline size-3 text-muted-foreground/50" />;
  return sortDir === 'asc'
    ? <ArrowUp className="ml-1 inline size-3" />
    : <ArrowDown className="ml-1 inline size-3" />;
}

export function MemberPerformance({ members, teamAvgHoursPerTask, timeFilter, onTimeFilterChange }: MemberPerformanceProps) {
  const [sortKey, setSortKey] = useState<SortKey>('completed');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;

    result = [...result].sort((a, b) => {
      const cmp = compareMembersByKey(a, b, sortKey);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [members, search, sortKey, sortDir]);

  const thClass = 'pb-3 font-medium cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Team Performance</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-[160px] pl-8 text-sm"
            />
          </div>
          <Select value={timeFilter} onValueChange={onTimeFilterChange}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="sprint">This sprint</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members in this project.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className={thClass} onClick={() => handleSort('name')}>
                      Member <SortIcon column="name" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className={thClass} onClick={() => handleSort('completed')}>
                      Task Breakdown <SortIcon column="completed" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className={thClass} onClick={() => handleSort('hours')}>
                      Hours <SortIcon column="hours" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className={thClass} onClick={() => handleSort('avgHours')}>
                      Avg Time/Task <SortIcon column="avgHours" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className={thClass} onClick={() => handleSort('quality')}>
                      Quality <SortIcon column="quality" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className={thClass} onClick={() => handleSort('bugs')}>
                      Bugs <SortIcon column="bugs" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        No members match &quot;{search}&quot;
                      </td>
                    </tr>
                  ) : (
                    filtered.map((member, idx) => (
                      <tr key={member.userId} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {member.imageUrl ? (
                              <img
                                src={member.imageUrl}
                                alt={member.name}
                                className="size-7 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                                style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                              >
                                {getInitials(member.name)}
                              </div>
                            )}
                            <span className="font-medium whitespace-nowrap">{member.name}</span>
                          </div>
                        </td>
                        <td className="min-w-[180px] py-3 pr-4">
                          <TaskBar
                            completed={member.tasks.completed}
                            inProgress={member.tasks.inProgress}
                            todo={member.tasks.todo}
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-semibold">{Math.round(member.hoursLogged)}</span>
                            <span className="text-muted-foreground">h</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <TrendArrow avgHours={member.avgHoursPerTask} teamAvg={teamAvgHoursPerTask} />
                        </td>
                        <td className="py-3 pr-4">
                          {member.tasks.completed === 0 ? (
                            <div className="flex gap-[3px]">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-6 w-2 rounded-sm bg-muted" />
                              ))}
                            </div>
                          ) : (
                            <QualityBlocks ratio={member.qualityRatio} />
                          )}
                        </td>
                        <td className="py-3">
                          <span className="text-sm font-medium">{member.bugCount}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
