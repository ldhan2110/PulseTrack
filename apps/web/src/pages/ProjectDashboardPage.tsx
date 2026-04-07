import { ListTodo, Clock, CheckCircle } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/dashboard/StatCard';
import { BurndownChart } from '@/components/dashboard/BurndownChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { useDashboard } from '@/hooks/useDashboard';

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
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const { data, isLoading } = useDashboard(projectId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-8 py-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <DashboardSkeleton />
      </div>
    );
  }

  const taskCounts = data?.taskCounts ?? { total: 0, byStatus: [], orphaned: 0 };
  const activeSprint = data?.activeSprint ?? null;
  const burndownData = data?.burndown ?? [];
  const activities = data?.recentActivity ?? [];

  const sprintProgress =
    activeSprint && activeSprint.totalPoints > 0
      ? Math.round((activeSprint.completedPoints / activeSprint.totalPoints) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* Row 1: Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Tasks" value={taskCounts.total} icon={ListTodo} />
        {taskCounts.byStatus
          .filter((s) => !s.isClosed)
          .slice(0, 2)
          .map((s) => (
            <StatCard key={s.statusId} title={s.name} value={s.count} icon={Clock} />
          ))}
        <StatCard
          title="Done"
          value={taskCounts.byStatus.filter((s) => s.isClosed).reduce((sum, s) => sum + s.count, 0)}
          icon={CheckCircle}
        />
      </div>

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

      {/* Row 3: Recent activity */}
      <RecentActivity activities={activities} />
    </div>
  );
}
