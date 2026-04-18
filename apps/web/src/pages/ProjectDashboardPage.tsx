import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardStatusStrip } from '@/components/dashboard/DashboardStatusStrip';
import { BurndownChart } from '@/components/dashboard/BurndownChart';
import { MemberPerformance } from '@/components/dashboard/MemberPerformance';
import { BugSummaryBanner } from '@/components/dashboard/BugSummaryBanner';
import { useDashboard } from '@/hooks/useDashboard';

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Row 1: scrollable stat cards */}
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[96px] min-w-[160px] rounded-xl shrink-0" />
        ))}
      </div>
      {/* Row 2: burndown + sprint */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-[340px] rounded-xl lg:col-span-3" />
        <Skeleton className="h-[340px] rounded-xl lg:col-span-2" />
      </div>
      {/* Row 3: bug banner */}
      <Skeleton className="h-[60px] rounded-xl" />
      {/* Row 4: member performance */}
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  );
}

export function ProjectDashboardPage() {
  const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const [timeFilter, setTimeFilter] = useState('all');
  const { data, isLoading } = useDashboard(projectId, timeFilter);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <DashboardSkeleton />
      </div>
    );
  }

  const taskCounts = data?.taskCounts ?? { total: 0, byStatus: [], orphaned: 0 };
  const activeSprint = data?.activeSprint ?? null;
  const burndownData = data?.burndown ?? [];
  const bugCounts = data?.bugCounts ?? { total: 0, open: 0, critical: 0 };
  const memberPerformance = data?.memberPerformance ?? [];
  const teamAvgHoursPerTask = data?.teamAvgHoursPerTask ?? 0;

  const sprintProgress =
    activeSprint && activeSprint.totalPoints > 0
      ? Math.round((activeSprint.completedPoints / activeSprint.totalPoints) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* Row 1: Dynamic status cards with horizontal scroll */}
      <DashboardStatusStrip total={taskCounts.total} byStatus={taskCounts.byStatus} projectPrefix={projectPrefix} />

      {/* Row 2: Burndown (60%) + Sprint progress (40%) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Burndown Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <BurndownChart data={burndownData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Sprint</CardTitle>
          </CardHeader>
          <CardContent>
            {activeSprint ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm font-medium">{activeSprint.name}</p>
                <Progress value={sprintProgress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {activeSprint.completedPoints} / {activeSprint.totalPoints} points completed
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active sprint</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Bug summary banner */}
      <BugSummaryBanner bugCounts={bugCounts} />

      {/* Row 4: Member performance table */}
      <MemberPerformance
        members={memberPerformance}
        teamAvgHoursPerTask={teamAvgHoursPerTask}
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
        projectPrefix={projectPrefix}
      />
    </div>
  );
}
