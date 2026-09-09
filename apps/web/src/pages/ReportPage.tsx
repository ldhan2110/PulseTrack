import { Fragment, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  format,
  subDays,
  subWeeks,
  subMonths,
  startOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWeekend,
} from 'date-fns';
import { CalendarIcon, ChevronRight } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

type GroupBy = 'day' | 'week' | 'month';

interface AppliedCriteria {
  range?: DateRange;
}

const DEFAULT_RANGE: DateRange = { from: subDays(startOfToday(), 7), to: startOfToday() };

// Preset ranges shown as quick-select chips under the Period control.
const PRESETS: { label: string; getRange: () => DateRange }[] = [
  { label: 'This week', getRange: () => ({ from: startOfWeek(startOfToday(), { weekStartsOn: 1 }), to: endOfWeek(startOfToday(), { weekStartsOn: 1 }) }) },
  { label: 'Last week', getRange: () => ({ from: startOfWeek(subWeeks(startOfToday(), 1), { weekStartsOn: 1 }), to: endOfWeek(subWeeks(startOfToday(), 1), { weekStartsOn: 1 }) }) },
  { label: 'Current month', getRange: () => ({ from: startOfMonth(startOfToday()), to: endOfMonth(startOfToday()) }) },
  { label: 'Last month', getRange: () => ({ from: startOfMonth(subMonths(startOfToday(), 1)), to: endOfMonth(subMonths(startOfToday(), 1)) }) },
];

// Mock user rows with their tickets — replaced by real TimeLog aggregation in a later backend change.
const MOCK_USERS = [
  {
    user: 'lucid (Van Phuc)',
    tickets: [
      { key: 'OTM-41278', title: 'Ocean import BL list export' },
      { key: 'OTM-41260', title: 'Shipment split modal fixes' },
      { key: 'OTM-41190', title: 'Billing code filter bar' },
    ],
  },
  {
    user: 'Mercy (Dang Khoa)',
    tickets: [
      { key: 'OTM-41031', title: 'Volume by sales report' },
      { key: 'OTM-41012', title: 'Dashboard negative profit table' },
    ],
  },
  {
    user: 'Jenifer (Hoang Ba)',
    tickets: [
      { key: 'OTM-41030', title: 'Date range input presets' },
      { key: 'OTM-40998', title: 'Balance sheet page errors' },
      { key: 'OTM-40971', title: 'IBSheet excel export' },
      { key: 'OTM-40950', title: 'Master data grid tuning' },
    ],
  },
  {
    user: 'Netiya (Rahul)',
    tickets: [
      { key: 'OTM-41029', title: 'Keycloak PKCE login flow' },
      { key: 'OTM-41005', title: 'AI config custom provider' },
    ],
  },
  {
    user: 'Baron (Nguyen Tru)',
    tickets: [{ key: 'OTM-41025', title: 'Wiki generation service' }],
  },
];

// Deterministic hours per seed/day so the layout reads real without random churn.
function mockHours(seed0: number, day: Date): number {
  if (isWeekend(day)) return 0;
  const seed = (seed0 * 3 + day.getDate() * 7) % 11;
  if (seed < 2) return 0;
  return Number((2 + (seed % 3) + ((seed0 + seed) % 4) * 0.1).toFixed(1));
}

// Drag handle on a column's right edge. Absolute, so the header cell needs `relative`.
function ResizeGrip({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <span
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-primary/40"
    />
  );
}

function formatRange(range?: DateRange): string {
  if (!range?.from) return 'Select period';
  if (!range.to) return format(range.from, 'dd/MM/yyyy');
  return `${format(range.from, 'dd/MM/yyyy')} – ${format(range.to, 'dd/MM/yyyy')}`;
}

export function ReportPage() {
  const [range, setRange] = useState<DateRange | undefined>(DEFAULT_RANGE);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [preset, setPreset] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedCriteria>({ range: DEFAULT_RANGE });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Resizable widths for the three pinned columns; drive both cell width and sticky left offset.
  const [colW, setColW] = useState({ item: 220, key: 110, total: 80 });

  // Drag a column's right edge to resize. ponytail: min 60px, no max — good enough for a mock.
  const startResize = (col: 'item' | 'key' | 'total', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colW[col];
    const onMove = (ev: MouseEvent) =>
      setColW((w) => ({ ...w, [col]: Math.max(60, startW + ev.clientX - startX) }));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const toggleRow = (user: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(user) ? next.delete(user) : next.add(user);
      return next;
    });

  // Manual calendar edits clear the active preset selection.
  const handleRangeChange = (r: DateRange | undefined) => {
    setRange(r);
    setPreset(null);
  };
  const handleApply = () => setApplied({ range });
  const handleReset = () => {
    setRange(DEFAULT_RANGE);
    setPreset(null);
  };
  // Preset radios update the period AND the table immediately.
  const handlePreset = (label: string, r: DateRange) => {
    setRange(r);
    setPreset(label);
    setApplied({ range: r });
  };

  // Derive day columns + month header groups from the applied range.
  const appliedRange = applied.range;
  const days =
    appliedRange?.from && appliedRange?.to ? eachDayOfInterval({ start: appliedRange.from, end: appliedRange.to }) : [];
  const monthGroups: { label: string; count: number }[] = [];
  days.forEach((d) => {
    const label = format(d, 'MMM yyyy');
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === label) last.count += 1;
    else monthGroups.push({ label, count: 1 });
  });

  // Each user aggregates their tickets; ticket daily hours roll up into the user's master row.
  const rows = MOCK_USERS.map((u, i) => {
    const tickets = u.tickets.map((tk, t) => {
      const values = days.map((d) => mockHours(i * 10 + t + 1, d));
      return { ...tk, values, total: values.reduce((s, v) => s + v, 0) };
    });
    const values = days.map((_, di) => tickets.reduce((s, tk) => s + tk.values[di], 0));
    return { ...u, tickets, values, total: values.reduce((s, v) => s + v, 0) };
  });
  const columnTotals = days.map((_, i) => rows.reduce((s, r) => s + r.values[i], 0));
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  // Sticky left offsets derive from the (resizable) pinned column widths.
  const keyLeft = colW.item;
  const totalLeft = colW.item + colW.key;
  const pin = (left: number, w: number) => ({ left, width: w, minWidth: w, maxWidth: w });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="text-xl font-semibold">Reports</h1>

      <ResizablePanelGroup direction="horizontal" className="min-h-150 w-full min-w-0 overflow-hidden rounded-lg border">
        {/* Left: Criteria */}
        <ResizablePanel defaultSize="300px" minSize="280px" maxSize="480px">
          <Card className="h-full rounded-none border-0 shadow-none">
            <CardHeader>
              <CardTitle>Criteria</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Period</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start whitespace-nowrap font-normal">
                      <CalendarIcon className="mr-2 size-4" />
                      {formatRange(range)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="range" selected={range} onSelect={handleRangeChange} numberOfMonths={2} />
                  </PopoverContent>
                </Popover>
                <fieldset className="mt-2 flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Date Range</label>
                  {PRESETS.map((p) => (
                    <label key={p.label} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="period-preset"
                        className="size-4 accent-primary"
                        checked={preset === p.label}
                        onChange={() => handlePreset(p.label, p.getRange())}
                      />
                      {p.label}
                    </label>
                  ))}
                </fieldset>
              </div>

              <div className="mt-2 flex gap-2">
                <Button onClick={handleApply}>Apply</Button>
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Report */}
        <ResizablePanel className="overflow-hidden">
          <div className="flex h-full min-w-0 flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {formatRange(applied.range)} · {groupBy}
              </p>
              <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <TabsList>
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
              <Table className="border-separate border-spacing-0 [&_td]:border-b [&_td]:border-r [&_th]:border-b [&_th]:border-r">
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  {/* Row 1: Item / Total span both rows; each month spans its days */}
                  <TableRow>
                    <TableHead
                      rowSpan={2}
                      style={pin(0, colW.item)}
                      className="sticky z-20 bg-muted text-center align-middle"
                    >
                      Item
                      <ResizeGrip onMouseDown={(e) => startResize('item', e)} />
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      style={pin(keyLeft, colW.key)}
                      className="sticky z-20 bg-muted text-center align-middle"
                    >
                      Key
                      <ResizeGrip onMouseDown={(e) => startResize('key', e)} />
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      style={pin(totalLeft, colW.total)}
                      className="sticky z-20 bg-muted text-center align-middle"
                    >
                      Total
                      <ResizeGrip onMouseDown={(e) => startResize('total', e)} />
                    </TableHead>
                    {monthGroups.map((m) => (
                      <TableHead key={m.label} colSpan={m.count} className="text-center font-semibold">
                        {m.label}
                      </TableHead>
                    ))}
                  </TableRow>
                  {/* Row 2: day number + weekday */}
                  <TableRow>
                    {days.map((d) => (
                      <TableHead key={d.toISOString()} className="min-w-[48px] text-center">
                        <div className="leading-tight">{format(d, 'd')}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">{format(d, 'EEE')}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isOpen = expanded.has(row.user);
                    return (
                      <Fragment key={row.user}>
                        {/* Master row: user total + daily roll-up, click to expand tickets */}
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(row.user)}>
                          <TableCell style={pin(0, colW.item)} className="sticky z-10 bg-background font-medium">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <ChevronRight
                                className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
                              />
                              <span className="truncate">{row.user}</span>
                            </span>
                          </TableCell>
                          <TableCell style={pin(keyLeft, colW.key)} className="sticky z-10 bg-background" />
                          <TableCell
                            style={pin(totalLeft, colW.total)}
                            className="sticky z-10 bg-background text-center font-medium"
                          >
                            {row.total.toFixed(1)}h
                          </TableCell>
                          {row.values.map((v, i) => (
                            <TableCell key={i} className="text-center tabular-nums">
                              {v > 0 ? `${v.toFixed(1)}h` : ''}
                            </TableCell>
                          ))}
                        </TableRow>
                        {/* Child rows: one per ticket the user logged time on */}
                        {isOpen &&
                          row.tickets.map((tk) => (
                            <TableRow key={tk.key} className="bg-muted/20">
                              <TableCell
                                style={pin(0, colW.item)}
                                className="sticky z-10 truncate bg-background pl-9 text-muted-foreground"
                                title={tk.title}
                              >
                                {tk.title}
                              </TableCell>
                              <TableCell
                                style={pin(keyLeft, colW.key)}
                                className="sticky z-10 bg-background text-center text-muted-foreground"
                              >
                                {tk.key}
                              </TableCell>
                              <TableCell
                                style={pin(totalLeft, colW.total)}
                                className="sticky z-10 bg-background text-center tabular-nums"
                              >
                                {tk.total.toFixed(1)}h
                              </TableCell>
                              {tk.values.map((v, i) => (
                                <TableCell key={i} className="text-center text-muted-foreground tabular-nums">
                                  {v > 0 ? `${v}h` : ''}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                      </Fragment>
                    );
                  })}
                </TableBody>
                <TableFooter className="sticky bottom-0 z-10 bg-muted">
                  <TableRow>
                    <TableCell style={pin(0, colW.item)} className="sticky z-20 bg-muted font-semibold">
                      Total
                    </TableCell>
                    <TableCell style={pin(keyLeft, colW.key)} className="sticky z-20 bg-muted" />
                    <TableCell
                      style={pin(totalLeft, colW.total)}
                      className="sticky z-20 bg-muted text-center font-semibold"
                    >
                      {grandTotal.toFixed(1)}h
                    </TableCell>
                    {columnTotals.map((t, i) => (
                      <TableCell key={i} className="text-center font-semibold tabular-nums">
                        {t > 0 ? `${t.toFixed(1)}h` : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
