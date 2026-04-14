import XLSX from 'xlsx-js-style';
import type { WbsPhase } from './types';

interface WbsExportRow {
  title: string;
  level: 0 | 1 | 2;
  planStart: Date | null;
  planEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  progress: number;
}

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(d: Date | null): string {
  if (!d) return '\u2014';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function flattenPhases(phases: WbsPhase[]): WbsExportRow[] {
  const rows: WbsExportRow[] = [];
  for (const phase of phases) {
    rows.push({
      title: phase.title,
      level: 0,
      planStart: parseDate(phase.planStart),
      planEnd: parseDate(phase.planEnd),
      actualStart: parseDate(phase.actualStart),
      actualEnd: parseDate(phase.actualEnd),
      progress: phase.progress,
    });
    for (const task of phase.tasks) {
      rows.push({
        title: task.title,
        level: 1,
        planStart: parseDate(task.planStart),
        planEnd: parseDate(task.planEnd),
        actualStart: parseDate(task.actualStart),
        actualEnd: parseDate(task.actualEnd),
        progress: task.progress,
      });
      for (const sub of task.subtasks) {
        rows.push({
          title: sub.title,
          level: 2,
          planStart: parseDate(sub.planStart),
          planEnd: parseDate(sub.planEnd),
          actualStart: parseDate(sub.actualStart),
          actualEnd: parseDate(sub.actualEnd),
          progress: sub.progress,
        });
      }
    }
  }
  return rows;
}

function getDateRange(rows: WbsExportRow[]): { start: Date; end: Date } | null {
  let earliest: Date | null = null;
  let latest: Date | null = null;
  for (const row of rows) {
    for (const d of [row.planStart, row.planEnd, row.actualStart, row.actualEnd]) {
      if (!d) continue;
      if (!earliest || d < earliest) earliest = d;
      if (!latest || d > latest) latest = d;
    }
  }
  if (!earliest || !latest) return null;
  earliest = new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate());
  latest = new Date(latest.getFullYear(), latest.getMonth(), latest.getDate());
  return { start: earliest, end: latest };
}

function getDaysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function isInRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const rangeStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const rangeEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return dayStart >= rangeStart && dayStart <= rangeEnd;
}

const LEVEL_COLORS: Record<0 | 1 | 2, string> = {
  0: '7C3AED', // purple — phases
  1: '3B82F6', // blue — tasks
  2: '6366F1', // indigo — subtasks
};

const headerStyle: XLSX.CellStyle = {
  font: { bold: true, color: { rgb: '000000' } },
  fill: { fgColor: { rgb: 'D9D9D9' } },
  border: {
    top: { color: { rgb: '000000' }, style: 'thin' },
    left: { color: { rgb: '000000' }, style: 'thin' },
    bottom: { color: { rgb: '000000' }, style: 'thin' },
    right: { color: { rgb: '000000' }, style: 'thin' },
  },
  alignment: { wrapText: true, vertical: 'center' },
};

const cellStyle: XLSX.CellStyle = {
  alignment: { wrapText: true, vertical: 'center' },
  border: {
    top: { color: { rgb: '000000' }, style: 'thin' },
    left: { color: { rgb: '000000' }, style: 'thin' },
    bottom: { color: { rgb: '000000' }, style: 'thin' },
    right: { color: { rgb: '000000' }, style: 'thin' },
  },
};

const phaseCellStyle: XLSX.CellStyle = {
  ...cellStyle,
  font: { bold: true },
};

export function exportWbsToExcel(phases: WbsPhase[]): void {
  const rows = flattenPhases(phases);
  if (rows.length === 0) return;

  const dateRange = getDateRange(rows);
  const ganttDays = dateRange ? getDaysBetween(dateRange.start, dateRange.end) : [];

  // Cap at 365 days to prevent oversized exports
  if (ganttDays.length > 365) {
    ganttDays.length = 365;
  }

  const DATA_COLS = 6;
  const dataHeaders = ['Task', 'Plan Start', 'Plan End', 'Actual Start', 'Actual End', 'Progress'];

  const worksheet: XLSX.WorkSheet = {};
  const totalCols = DATA_COLS + ganttDays.length;

  // Write data headers
  for (let c = 0; c < DATA_COLS; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    worksheet[cellRef] = { v: dataHeaders[c], t: 's', s: headerStyle };
  }

  // Write gantt day headers
  for (let i = 0; i < ganttDays.length; i++) {
    const d = ganttDays[i];
    const colIdx = DATA_COLS + i;
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    const showMonth = i === 0 || d.getDate() === 1;
    const label = showMonth
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : `${d.getDate()}`;
    worksheet[cellRef] = { v: label, t: 's', s: headerStyle };
  }

  // Write data rows
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const excelRow = r + 1;
    const indent = '  '.repeat(row.level);
    const style = row.level === 0 ? phaseCellStyle : cellStyle;

    const taskRef = XLSX.utils.encode_cell({ r: excelRow, c: 0 });
    worksheet[taskRef] = { v: `${indent}${row.title}`, t: 's', s: style };

    const psRef = XLSX.utils.encode_cell({ r: excelRow, c: 1 });
    worksheet[psRef] = { v: formatDate(row.planStart), t: 's', s: style };

    const peRef = XLSX.utils.encode_cell({ r: excelRow, c: 2 });
    worksheet[peRef] = { v: formatDate(row.planEnd), t: 's', s: style };

    const asRef = XLSX.utils.encode_cell({ r: excelRow, c: 3 });
    worksheet[asRef] = { v: formatDate(row.actualStart), t: 's', s: style };

    const aeRef = XLSX.utils.encode_cell({ r: excelRow, c: 4 });
    worksheet[aeRef] = { v: formatDate(row.actualEnd), t: 's', s: style };

    const progRef = XLSX.utils.encode_cell({ r: excelRow, c: 5 });
    worksheet[progRef] = { v: `${Math.round(row.progress)}%`, t: 's', s: style };

    // Gantt bars represent planned schedule only (planStart → planEnd)
    for (let d = 0; d < ganttDays.length; d++) {
      const colIdx = DATA_COLS + d;
      const cellRef = XLSX.utils.encode_cell({ r: excelRow, c: colIdx });
      if (isInRange(ganttDays[d], row.planStart, row.planEnd)) {
        worksheet[cellRef] = {
          v: '',
          t: 's',
          s: {
            fill: { fgColor: { rgb: LEVEL_COLORS[row.level] } },
          },
        };
      }
    }
  }

  // Set worksheet range
  worksheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length, c: totalCols - 1 },
  });

  // Set column widths
  const colWidths: XLSX.ColInfo[] = [
    { wch: 35 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
    ...ganttDays.map(() => ({ wch: 3 })),
  ];
  worksheet['!cols'] = colWidths;

  // Create workbook and download
  const today = new Date().toISOString().slice(0, 10);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'WBS');
  XLSX.writeFile(workbook, `WBS-Export-${today}.xlsx`);
}
