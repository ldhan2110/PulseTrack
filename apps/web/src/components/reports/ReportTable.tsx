import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import type { TimesheetRow } from '@/lib/types';
import { useColumnResize, ResizeGrip } from './utils/useColumnResize';
import { UserCell } from './UserCell';

interface ReportTableProps {
  rows: TimesheetRow[];
  days: Date[];
  projectPrefix: string;
}

export function ReportTable({ rows, days, projectPrefix }: ReportTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { colW, startResize } = useColumnResize();

  const toggleRow = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Month header groups over the day columns.
  const monthGroups: { label: string; count: number }[] = [];
  days.forEach((d) => {
    const label = format(d, 'MMM yyyy');
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === label) last.count += 1;
    else monthGroups.push({ label, count: 1 });
  });

  const columnTotals = days.map((_, i) => rows.reduce((s, r) => s + (r.values[i] ?? 0), 0));
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  // Sticky left offsets derive from the (resizable) pinned column widths.
  const keyLeft = colW.item;
  const totalLeft = colW.item + colW.key;
  const pin = (left: number, w: number) => ({ left, width: w, minWidth: w, maxWidth: w });

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border">
      <Table className="border-separate border-spacing-0 [&_td]:border-b [&_td]:border-r [&_td]:py-1 [&_th]:border-b [&_th]:border-r [&_th]:py-1">
        <TableHeader className="sticky top-0 z-10 bg-muted">
          {/* Row 1: Item / Key / Total span both rows; each month spans its days */}
          <TableRow>
            <TableHead rowSpan={2} style={pin(0, colW.item)} className="sticky z-20 bg-muted text-center align-middle">
              Item
              <ResizeGrip onMouseDown={(e) => startResize('item', e)} />
            </TableHead>
            <TableHead rowSpan={2} style={pin(keyLeft, colW.key)} className="sticky z-20 bg-muted text-center align-middle">
              Key
              <ResizeGrip onMouseDown={(e) => startResize('key', e)} />
            </TableHead>
            <TableHead rowSpan={2} style={pin(totalLeft, colW.total)} className="sticky z-20 bg-muted text-center align-middle">
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
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3 + days.length} className="h-24 text-center text-muted-foreground">
                No members in this project.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => {
            const isOpen = expanded.has(row.user.id);
            return (
              <Fragment key={row.user.id}>
                {/* Master row: user total + daily roll-up, click to expand tickets */}
                <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(row.user.id)}>
                  <TableCell style={pin(0, colW.item)} className="sticky z-10 bg-background font-medium">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ChevronRight
                        className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      />
                      <UserCell user={row.user} />
                    </span>
                  </TableCell>
                  <TableCell style={pin(keyLeft, colW.key)} className="sticky z-10 bg-background" />
                  <TableCell style={pin(totalLeft, colW.total)} className="sticky z-10 bg-background text-center font-medium">
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
                  row.tickets.map((tk) => {
                    const tkTotal = tk.values.reduce((s, v) => s + v, 0);
                    return (
                      <TableRow key={tk.key} className="bg-muted/20">
                        <TableCell
                          style={pin(0, colW.item)}
                          className="sticky z-10 truncate bg-background pl-9 text-muted-foreground"
                          title={tk.title}
                        >
                          {tk.title}
                        </TableCell>
                        <TableCell style={pin(keyLeft, colW.key)} className="sticky z-10 bg-background text-center">
                          <Link
                            to={`/projects/${projectPrefix}/tasks/${tk.key}`}
                            className="text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
                          >
                            {tk.key}
                          </Link>
                        </TableCell>
                        <TableCell style={pin(totalLeft, colW.total)} className="sticky z-10 bg-background text-center tabular-nums">
                          {tkTotal.toFixed(1)}h
                        </TableCell>
                        {tk.values.map((v, i) => (
                          <TableCell key={i} className="text-center text-muted-foreground tabular-nums">
                            {v > 0 ? `${v.toFixed(1)}h` : ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
              </Fragment>
            );
          })}
        </TableBody>
        <TableFooter className="sticky bottom-0 z-10 bg-muted">
          <TableRow>
            <TableCell style={pin(0, colW.item)} className="sticky z-20 bg-muted text-center font-semibold">
              Total
            </TableCell>
            <TableCell style={pin(keyLeft, colW.key)} className="sticky z-20 bg-muted" />
            <TableCell style={pin(totalLeft, colW.total)} className="sticky z-20 bg-muted text-center font-semibold">
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
  );
}
