import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MemberPerformanceRow } from '@/lib/types';

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

export function MemberPerformance({ members, teamAvgHoursPerTask, timeFilter, onTimeFilterChange }: MemberPerformanceProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Team Performance</CardTitle>
        <Select value={timeFilter} onValueChange={onTimeFilterChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="sprint">This sprint</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members in this project.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">Member</th>
                  <th className="pb-3 font-medium">Task Breakdown</th>
                  <th className="pb-3 font-medium">Hours</th>
                  <th className="pb-3 font-medium">Avg Time/Task</th>
                  <th className="pb-3 font-medium">Quality</th>
                  <th className="pb-3 font-medium">Bugs</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, idx) => (
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
                        <span className="font-medium">{member.name}</span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
