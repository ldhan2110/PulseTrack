import { useParams } from 'react-router-dom';
import { ListTodo, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/dashboard/StatCard';
import { BurndownChart } from '@/components/dashboard/BurndownChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { useDashboard } from '@/hooks/useDashboard';
import type { ActivityItem, BurndownPoint } from '@/lib/types';

function buildBurndownChartData(burndown: BurndownPoint[]) {
  if (burndown.length === 0) return [];
  const startPoints = burndown[0].remaining;
  const n = burndown.length;
  return burndown.map((point, i) => ({
    date: point.date,
    actual: point.remaining,
    ideal: Math.round(startPoints * (1 - i / (n - 1 || 1))),
  }));
}

function mapActivity(activity: ActivityItem) {
  return {
    id: activity.id,
    type: activity.type,
    title: activity.description,
    actor: activity.user?.name ?? 'Unknown',
    timestamp: activity.createdAt,
  };
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Row 1: 4 stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[96px] rounded-xl" />
        ))}
      </div>
      {/* Row 2: burndown + sprint */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-[340px] rounded-xl lg:col-span-3" />
        <Skeleton className="h-[340px] rounded-xl lg:col-span-2" />
      </div>
      {/* Row 3: activity */}
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  );
}

export function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading } = useDashboard(projectId ?? '');

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-8 py-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <DashboardSkeleton />
      </div>
    );
  }

  const taskCounts = data?.taskStats ?? { total: 0, inProgress: 0, done: 0, blocked: 0 };
  const activeSprint = data?.activeSprint ?? null;
  const sprintStats = data?.sprintStats ?? null;
  const burndownChartData = buildBurndownChartData(data?.burndown ?? []);
  const activities = (data?.recentActivity ?? []).map(mapActivity);

  const sprintProgress =
    sprintStats && sprintStats.totalPoints > 0
      ? Math.round((sprintStats.completedPoints / sprintStats.totalPoints) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* Row 1: Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Tasks" value={taskCounts.total} icon={ListTodo} />
        <StatCard title="In Progress" value={taskCounts.inProgress} icon={Clock} />
        <StatCard title="Done" value={taskCounts.done} icon={CheckCircle} />
        <StatCard title="Blocked" value={taskCounts.blocked} icon={AlertTriangle} variant="danger" />
      </div>

      {/* Row 2: Burndown (60%) + Sprint progress (40%) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Burndown Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <BurndownChart data={burndownChartData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Sprint</CardTitle>
          </CardHeader>
          <CardContent>
            {activeSprint && sprintStats ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm font-medium">{activeSprint.name}</p>
                <Progress value={sprintProgress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {sprintStats.completedPoints} / {sprintStats.totalPoints} points completed
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active sprint</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recent activity */}
      <RecentActivity activities={activities} />
    </div>
  );
}
