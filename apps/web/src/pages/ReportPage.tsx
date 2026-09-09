import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DateRange } from 'react-day-picker';
import { format, subDays, startOfToday } from 'date-fns';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectByPrefix } from '@/hooks/useProjects';
import { useReportTimesheet } from '@/hooks/useReportTimesheet';
import { CriteriaFilter } from '@/components/reports/CriteriaFilter';
import { ReportTable } from '@/components/reports/ReportTable';
import { formatRange } from '@/components/reports/utils/format';
import type { GroupBy } from '@/components/reports/utils/presets';

const DEFAULT_RANGE: DateRange = { from: subDays(startOfToday(), 7), to: startOfToday() };
const toParam = (d?: Date) => (d ? format(d, 'yyyy-MM-dd') : undefined);

export function ReportPage() {
  const { projectPrefix } = useParams<{ projectPrefix: string }>();
  const { data: project } = useProjectByPrefix(projectPrefix ?? '');

  const [range, setRange] = useState<DateRange | undefined>(DEFAULT_RANGE);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [preset, setPreset] = useState<string | null>(null);
  const [applied, setApplied] = useState<DateRange | undefined>(DEFAULT_RANGE);

  // Debounce range → applied so the search auto-triggers 400ms after the last change (no Apply button).
  useEffect(() => {
    const t = setTimeout(() => setApplied(range), 400);
    return () => clearTimeout(t);
  }, [range]);

  const { data, isLoading } = useReportTimesheet(project?.id ?? '', toParam(applied?.from), toParam(applied?.to));
  // days come back as ISO date strings; parse to local Date for column formatting.
  const days = (data?.days ?? []).map((s) => new Date(`${s}T00:00:00`));
  const rows = data?.rows ?? [];

  // Manual calendar edits clear the active preset selection.
  const handleRangeChange = (r: DateRange | undefined) => {
    setRange(r);
    setPreset(null);
  };
  const handleReset = () => {
    setRange(DEFAULT_RANGE);
    setPreset(null);
  };
  const handlePreset = (label: string, r: DateRange) => {
    setRange(r);
    setPreset(label);
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="text-xl font-semibold">Reports</h1>

      <ResizablePanelGroup direction="horizontal" className="min-h-150 w-full min-w-0 overflow-hidden rounded-lg border">
        {/* Left: Criteria */}
        <ResizablePanel defaultSize="300px" minSize="280px" maxSize="480px">
          <CriteriaFilter
            range={range}
            preset={preset}
            onRangeChange={handleRangeChange}
            onPreset={handlePreset}
            onReset={handleReset}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Report */}
        <ResizablePanel className="overflow-hidden">
          <div className="flex h-full min-w-0 flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {formatRange(applied)} · {groupBy}
              </p>
              <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <TabsList>
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <ReportTable rows={rows} days={days} projectPrefix={projectPrefix ?? ''} />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
