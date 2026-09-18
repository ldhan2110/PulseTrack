import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { MyWorkStrip } from '@/components/dashboard/MyWorkStrip';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { DashboardStatusStrip } from '@/components/dashboard/DashboardStatusStrip';
import { BurndownChart } from '@/components/dashboard/BurndownChart';
import { MemberPerformance } from '@/components/dashboard/MemberPerformance';
import { BugSummaryBanner } from '@/components/dashboard/BugSummaryBanner';
import { useDashboard } from '@/hooks/useDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/auth/useAuth';

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <Skeleton className="h-[64px] rounded-xl" />
      {/* My Work strip */}
      <Skeleton className="h-[88px] rounded-xl" />
      {/* Team tasks strip */}
      <Skeleton className="h-[88px] rounded-xl" />
      {/* Burndown + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-[340px] rounded-xl lg:col-span-3" />
        <Skeleton className="h-[340px] rounded-xl lg:col-span-2" />
      </div>
      {/* Bug banner */}
      <Skeleton className="h-[60px] rounded-xl" />
      {/* Member performance */}
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  );
}

export function ProjectDashboardPage() {
  const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const { user } = useAuth();
  const { can } = usePermissions(projectId);
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
  const myWork = data?.myWork ?? { openTasks: 0, dueSoon: 0, overdue: 0, myBugs: 0 };
  const activity = data?.activity ?? [];

  const canTasks = can('tasks', 'update');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* Hero + My Work — always visible */}
      <DashboardHero name={user?.name ?? user?.username ?? 'there'} activeSprint={activeSprint} projectPrefix={projectPrefix} />
      <MyWorkStrip myWork={myWork} userId={user?.id ?? ''} projectPrefix={projectPrefix} />

      {/* Team tasks — gate tasks.update */}
      {canTasks && (
        <DashboardStatusStrip total={taskCounts.total} byStatus={taskCounts.byStatus} projectPrefix={projectPrefix} />
      )}

      {/* Burndown (gate tasks.update) + Activity (always) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {canTasks && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Burndown Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <BurndownChart data={burndownData} />
            </CardContent>
          </Card>
        )}
        <div className={canTasks ? 'lg:col-span-2' : 'lg:col-span-5'}>
          <ActivityFeed activity={activity} />
        </div>
      </div>

      {/* Bug summary — gate bugs.update */}
      {can('bugs', 'update') && <BugSummaryBanner bugCounts={bugCounts} />}

      {/* Member performance — gate members.view */}
      {can('members', 'view') && (
        <MemberPerformance
          members={memberPerformance}
          teamAvgHoursPerTask={teamAvgHoursPerTask}
          timeFilter={timeFilter}
          onTimeFilterChange={setTimeFilter}
          projectPrefix={projectPrefix}
        />
      )}
    </div>
  );
}
