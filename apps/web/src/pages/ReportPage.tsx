import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DateRange } from 'react-day-picker';
import { format, subDays, startOfToday } from 'date-fns';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useProjectByPrefix } from '@/hooks/useProjects';
import { usePermissions } from '@/hooks/usePermissions';
import { useReportTimesheet } from '@/hooks/useReportTimesheet';
import { CriteriaFilter } from '@/components/reports/CriteriaFilter';
import { ReportTable } from '@/components/reports/ReportTable';
import { bucketize } from '@/components/reports/utils/bucketize';
import type { GroupBy } from '@/components/reports/utils/presets';

const DEFAULT_RANGE: DateRange = { from: subDays(startOfToday(), 7), to: startOfToday() };
const toParam = (d?: Date) => (d ? format(d, 'yyyy-MM-dd') : undefined);

export function ReportPage() {
  const { projectPrefix } = useParams<{ projectPrefix: string }>();
  const { data: project } = useProjectByPrefix(projectPrefix ?? '');
  const { can } = usePermissions(project?.id ?? '');

  const [range, setRange] = useState<DateRange | undefined>(DEFAULT_RANGE);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [preset, setPreset] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [applied, setApplied] = useState<DateRange | undefined>(DEFAULT_RANGE);

  // Search inputs debounced into applied* so filtering auto-triggers 300ms after typing.
  const [userQuery, setUserQuery] = useState('');
  const [ticketQuery, setTicketQuery] = useState('');
  const [appliedUser, setAppliedUser] = useState('');
  const [appliedTicket, setAppliedTicket] = useState('');

  // Debounce range → applied so the search auto-triggers 400ms after the last change (no Apply button).
  useEffect(() => {
    const t = setTimeout(() => setApplied(range), 400);
    return () => clearTimeout(t);
  }, [range]);

  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedUser(userQuery);
      setAppliedTicket(ticketQuery);
    }, 300);
    return () => clearTimeout(t);
  }, [userQuery, ticketQuery]);

  // Filtering happens in the backend (reduces payload); the period toggle stays client-side.
  const { data, isLoading } = useReportTimesheet(project?.id ?? '', toParam(applied?.from), toParam(applied?.to), {
    user: appliedUser,
    ticket: appliedTicket,
    typeIds: selectedTypes,
  });
  // days come back as ISO date strings; parse to local Date for column formatting.
  const days = (data?.days ?? []).map((s) => new Date(`${s}T00:00:00`));
  const { columns, rows } = bucketize(days, data?.rows ?? [], groupBy);

  // Manual calendar edits clear the active preset selection.
  const handleRangeChange = (r: DateRange | undefined) => {
    setRange(r);
    setPreset(null);
  };
  const handleReset = () => {
    setRange(DEFAULT_RANGE);
    setPreset(null);
    setSelectedTypes([]);
  };
  const handlePreset = (label: string, r: DateRange) => {
    setRange(r);
    setPreset(label);
  };
  const handleToggleType = (typeId: string) =>
    setSelectedTypes((prev) => (prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]));
  const handleSetTypes = (ids: string[]) => setSelectedTypes(ids);

  const canExport = can('report', 'view') && !!project?.id && !!applied?.from && !!applied?.to;
  const handleExport = () => {
    if (!canExport) return;
    api.exportReportTimesheet(
      project!.id,
      toParam(applied!.from)!,
      toParam(applied!.to)!,
      { user: appliedUser, ticket: appliedTicket, typeIds: selectedTypes },
      groupBy,
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reports</h1>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!canExport}>
          <Download className="size-4" />
          Export Excel
        </Button>
      </div>

      <ResizablePanelGroup direction="horizontal" className="min-h-150 w-full min-w-0 overflow-hidden rounded-lg border">
        {/* Left: Criteria */}
        <ResizablePanel defaultSize="300px" minSize="280px" maxSize="480px">
          <CriteriaFilter
            projectId={project?.id ?? ''}
            range={range}
            preset={preset}
            selectedTypes={selectedTypes}
            onRangeChange={handleRangeChange}
            onPreset={handlePreset}
            onToggleType={handleToggleType}
            onSetTypes={handleSetTypes}
            onReset={handleReset}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Report */}
        <ResizablePanel className="overflow-hidden">
          <div className="flex h-full min-w-0 flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Filter user"
                  className="h-9 w-40"
                />
                <Input
                  value={ticketQuery}
                  onChange={(e) => setTicketQuery(e.target.value)}
                  placeholder="Filter ticket / key"
                  className="h-9 w-44"
                />
              </div>
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
              <ReportTable rows={rows} columns={columns} projectPrefix={projectPrefix ?? ''} />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
