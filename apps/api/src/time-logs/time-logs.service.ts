import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { hasPermission, type RolePermissions } from '../auth/permissions';
import { format, getISOWeek, getISOWeekYear, startOfISOWeek, endOfISOWeek } from 'date-fns';

export interface TimesheetFilters {
  userIds?: string[];
  ticket?: string;
  typeIds?: string[];
}

export type GroupBy = 'day' | 'week' | 'month';

interface ReportColumn {
  key: string;
  label: string;
  sublabel?: string;
  group: string;
}

interface BucketTicket {
  key: string;
  title: string;
  values: number[];
}
interface BucketRow {
  user: { id: string; name: string | null; imageUrl: string | null };
  tickets: BucketTicket[];
  values: number[];
  total: number;
}

// Port of apps/web/src/components/reports/utils/bucketize.ts — groups index-aligned
// daily columns into day/week/month buckets and sums each row's values per bucket.
// `days` are yyyy-MM-dd strings; parse as local midnight to match the client.
export function bucketizeTimesheet(
  days: string[],
  rows: BucketRow[],
  groupBy: GroupBy,
): { columns: ReportColumn[]; rows: BucketRow[] } {
  const parse = (s: string) => new Date(`${s}T00:00:00`);

  const keyOf = (d: Date): string => {
    if (groupBy === 'week') return `${getISOWeekYear(d)}-W${getISOWeek(d)}`;
    if (groupBy === 'month') return format(d, 'yyyy-MM');
    return format(d, 'yyyy-MM-dd');
  };

  const order: string[] = [];
  const members = new Map<string, number[]>();
  days.forEach((s, i) => {
    const k = keyOf(parse(s));
    if (!members.has(k)) {
      members.set(k, []);
      order.push(k);
    }
    members.get(k)!.push(i);
  });

  const columns: ReportColumn[] = order.map((k) => {
    const idxs = members.get(k)!;
    const first = parse(days[idxs[0]]);
    if (groupBy === 'week') {
      return { key: k, label: `W${getISOWeek(first)}`, sublabel: `${format(startOfISOWeek(first), 'MMM d')}–${format(endOfISOWeek(first), 'd')}`, group: format(first, 'MMM yyyy') };
    }
    if (groupBy === 'month') {
      return { key: k, label: format(first, 'MMM'), group: format(first, 'yyyy') };
    }
    return { key: k, label: format(first, 'd'), sublabel: format(first, 'EEE'), group: format(first, 'MMM yyyy') };
  });

  const sumBuckets = (values: number[]): number[] =>
    order.map((k) => members.get(k)!.reduce((s, i) => s + (values[i] ?? 0), 0));

  const outRows: BucketRow[] = rows.map((row) => ({
    ...row,
    values: sumBuckets(row.values),
    tickets: row.tickets.map((t) => ({ ...t, values: sumBuckets(t.values) })),
  }));

  return { columns, rows: outRows };
}

@Injectable()
export class TimeLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(projectId: string, taskId: string, userId: string, dto: CreateTimeLogDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, taskKey: true, progress: true, estimatedMinutes: true, _count: { select: { children: true } } },
    });

    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Task not found');
    }

    if (task._count.children > 0) {
      throw new BadRequestException('Cannot log time on a task that has sub-tasks. Log time on sub-tasks instead.');
    }

    if (!task.estimatedMinutes) {
      throw new BadRequestException('Cannot log time without an estimate. Please set an estimate first.');
    }

    const [timeLog] = await this.prisma.$transaction([
      this.prisma.timeLog.create({
        data: {
          minutes: dto.minutes,
          comment: dto.comment,
          loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
          progress: dto.progress,
          taskId,
          userId,
        },
        include: {
          user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        },
      }),
      ...(dto.progress !== undefined
        ? [
            this.prisma.task.update({
              where: { id: taskId },
              data: { progress: dto.progress },
            }),
          ]
        : []),
    ]);

    const hours = Math.floor(dto.minutes / 60);
    const mins = dto.minutes % 60;
    const formatted = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;

    const historyValue = `${formatted}${dto.comment ? ` — ${dto.comment}` : ''}${dto.progress !== undefined ? ` (progress: ${dto.progress}%)` : ''}`;

    await this.prisma.taskHistory.create({
      data: {
        taskId,
        actorId: userId,
        field: 'timeLog',
        oldValue: null,
        newValue: historyValue,
      },
    });

    this.notifications.notifyProject(projectId, 'task:updated', { projectId, taskId, task: { id: taskId } });

    return timeLog;
  }

  async findAll(taskId: string) {
    return this.prisma.timeLog.findMany({
      where: { taskId },
      orderBy: { loggedAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
    });
  }

  // Per-project timesheet: TimeLogs in [from, to] grouped by user → task, rolled into per-day hour buckets.
  async getTimesheet(projectId: string, from: Date, to: Date, filters: TimesheetFilters = {}) {
    const MS_PER_DAY = 86_400_000;
    // Normalize to day boundaries so the bucket count matches the frontend's eachDayOfInterval.
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    const dayCount = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
    // Format in LOCAL time — toISOString() is UTC and shifts the day at non-UTC offsets.
    const toLocalYmd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const days = Array.from({ length: dayCount }, (_, i) =>
      toLocalYmd(new Date(start.getTime() + i * MS_PER_DAY)),
    );

    const userIds = filters.userIds ?? [];
    const userFilter = userIds.length ? { user: { id: { in: userIds } } } : {};
    const ticket = filters.ticket?.trim();
    const typeIds = filters.typeIds ?? [];
    // A ticket filter narrows to specific tickets, so 0-hour members shouldn't appear.
    // Type filter is a category, not a ticket narrow — 0-hour members still show.
    const hasTicketFilter = !!ticket;

    const [members, logs] = await Promise.all([
      // Skip seeding empty member rows when a ticket/type filter is active — they'd never match.
      hasTicketFilter
        ? Promise.resolve([])
        : this.prisma.projectMember.findMany({
            where: {
              projectId,
              ...userFilter,
            },
            select: { user: { select: { id: true, name: true, imageUrl: true } } },
          }),
      this.prisma.timeLog.findMany({
        where: {
          loggedAt: { gte: start, lt: new Date(end.getTime() + MS_PER_DAY) },
          ...userFilter,
          task: {
            projectId,
            ...(typeIds.length ? { taskTypeId: { in: typeIds } } : {}),
            ...(ticket
              ? { OR: [{ title: { contains: ticket, mode: 'insensitive' } }, { taskKey: { contains: ticket, mode: 'insensitive' } }] }
              : {}),
          },
        },
        select: {
          minutes: true,
          loggedAt: true,
          user: { select: { id: true, name: true, imageUrl: true } },
          task: { select: { id: true, taskKey: true, title: true, taskTypeId: true } },
        },
      }),
    ]);

    // user id → { user, tickets: Map<taskId, {key,title,values}> }
    const byUser = new Map<
      string,
      { user: { id: string; name: string | null; imageUrl: string | null }; tickets: Map<string, { key: string; title: string; taskTypeId: string | null; values: number[] }> }
    >();

    // Seed every project member so users with 0 logged hours still appear as a row.
    for (const m of members) {
      byUser.set(m.user.id, { user: m.user, tickets: new Map() });
    }

    for (const log of logs) {
      const dayIndex = Math.floor(
        (new Date(log.loggedAt.getFullYear(), log.loggedAt.getMonth(), log.loggedAt.getDate()).getTime() - start.getTime()) / MS_PER_DAY,
      );
      if (dayIndex < 0 || dayIndex >= dayCount) continue;

      let u = byUser.get(log.user.id);
      if (!u) {
        u = { user: log.user, tickets: new Map() };
        byUser.set(log.user.id, u);
      }
      let ticket = u.tickets.get(log.task.id);
      if (!ticket) {
        ticket = { key: log.task.taskKey ?? log.task.id, title: log.task.title, taskTypeId: log.task.taskTypeId, values: Array(dayCount).fill(0) };
        u.tickets.set(log.task.id, ticket);
      }
      ticket.values[dayIndex] += log.minutes / 60;
    }

    const rows = Array.from(byUser.values()).map(({ user, tickets }) => {
      const ticketList = Array.from(tickets.values());
      const values = Array.from({ length: dayCount }, (_, i) => ticketList.reduce((s, t) => s + t.values[i], 0));
      return {
        user,
        tickets: ticketList,
        values,
        total: values.reduce((s, v) => s + v, 0),
      };
    });

    return { rows, days };
  }

  async remove(projectId: string, taskId: string, timeLogId: string, userId: string, permissions: RolePermissions) {
    const timeLog = await this.prisma.timeLog.findUnique({
      where: { id: timeLogId },
      select: { id: true, userId: true, taskId: true, task: { select: { projectId: true } } },
    });

    if (!timeLog || timeLog.taskId !== taskId || timeLog.task.projectId !== projectId) {
      throw new NotFoundException('Time log not found');
    }

    if (timeLog.userId !== userId && !hasPermission(permissions, 'tasks', 'delete')) {
      throw new ForbiddenException('Only the author or a PM can delete time logs');
    }

    await this.prisma.timeLog.delete({ where: { id: timeLogId } });

    this.notifications.notifyProject(projectId, 'task:updated', { projectId, taskId, task: { id: taskId } });
  }

  async exportTimesheetExcel(
    projectId: string,
    from: Date,
    to: Date,
    filters: TimesheetFilters,
    groupBy: GroupBy,
  ): Promise<Buffer> {
    const { rows: dailyRows, days } = await this.getTimesheet(projectId, from, to, filters);
    const { columns, rows } = bucketizeTimesheet(days, dailyRows, groupBy);

    const ExcelJS = await import('exceljs');
    const Workbook = ExcelJS.default?.Workbook ?? ExcelJS.Workbook;
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Timesheet');

    const PIN = 3; // Item, Key, Total
    const totalCols = PIN + columns.length;

    // Freeze the three summary columns and both header rows (mirrors the sticky table).
    sheet.views = [{ state: 'frozen', xSplit: PIN, ySplit: 2 }];
    // Outline grouping: ticket rows nest one level under their user row, roll-up on top.
    sheet.properties.outlineLevelRow = 1;
    (sheet.properties as any).summaryBelow = false;

    const thin = { style: 'thin' as const };
    const allBorders = { top: thin, left: thin, bottom: thin, right: thin };
    const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9D9D9' } };
    const HOUR_FMT = '0.0"h"';

    // ── Header row 1: Item/Key/Total + merged period group super-headers ──
    const row1 = sheet.getRow(1);
    row1.getCell(1).value = 'Item';
    row1.getCell(2).value = 'Key';
    row1.getCell(3).value = 'Total';
    // Coalesce consecutive equal `group` into merged runs.
    let runStart = 0;
    for (let i = 0; i <= columns.length; i++) {
      const atEnd = i === columns.length;
      if (atEnd || columns[i].group !== columns[runStart].group) {
        const startCol = PIN + 1 + runStart;
        const endCol = PIN + i;
        row1.getCell(startCol).value = columns[runStart].group;
        if (endCol > startCol) sheet.mergeCells(1, startCol, 1, endCol);
        runStart = i;
      }
    }

    // ── Header row 2: per-column label + sublabel ──
    const row2 = sheet.getRow(2);
    columns.forEach((c, i) => {
      const cell = row2.getCell(PIN + 1 + i);
      cell.value = c.sublabel ? `${c.label}\n${c.sublabel}` : c.label;
    });
    // Item/Key/Total span both header rows.
    for (let col = 1; col <= PIN; col++) sheet.mergeCells(1, col, 2, col);

    for (const rowIdx of [1, 2]) {
      const r = sheet.getRow(rowIdx);
      for (let col = 1; col <= totalCols; col++) {
        const cell = r.getCell(col);
        cell.font = { bold: true };
        cell.fill = HEADER_FILL;
        cell.border = allBorders;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }
    }

    // ── Body: user roll-up row (outline 0) then its ticket rows (outline 1) ──
    for (const row of rows) {
      const userRow = sheet.addRow([row.user.name ?? '', '', row.total, ...row.values]);
      styleBodyRow(userRow, PIN, totalCols, allBorders, HOUR_FMT, true);

      for (const tk of row.tickets) {
        const tkTotal = tk.values.reduce((s, v) => s + v, 0);
        const tkRow = sheet.addRow([tk.title, tk.key, tkTotal, ...tk.values]);
        tkRow.outlineLevel = 1;
        styleBodyRow(tkRow, PIN, totalCols, allBorders, HOUR_FMT, false, true);
      }
    }

    // ── Footer: grand total + per-column totals ──
    const columnTotals = columns.map((_, i) => rows.reduce((s, r) => s + (r.values[i] ?? 0), 0));
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    const footer = sheet.addRow(['Total', '', grandTotal, ...columnTotals]);
    footer.eachCell((cell, col) => {
      cell.font = { bold: true };
      cell.fill = HEADER_FILL;
      cell.border = allBorders;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (col >= PIN) cell.numFmt = HOUR_FMT; // Total + day columns show "Nh"
    });

    sheet.getColumn(1).width = 28;
    sheet.getColumn(2).width = 14;
    sheet.getColumn(3).width = 10;
    for (let col = PIN + 1; col <= totalCols; col++) sheet.getColumn(col).width = 8;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

function styleBodyRow(
  row: any,
  pin: number,
  totalCols: number,
  borders: any,
  hourFmt: string,
  bold: boolean,
  indent = false, // ticket titles are nested under the user (FE pl-9)
): void {
  for (let col = 1; col <= totalCols; col++) {
    const cell = row.getCell(col);
    cell.border = borders;
    if (col === 1) {
      cell.font = { bold };
      cell.alignment = { vertical: 'middle', indent: indent ? 2 : 0 };
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (col >= pin) cell.numFmt = hourFmt; // Total + day columns show "Nh"
      if (col > pin && cell.value === 0) cell.value = null; // blank zeros, like the table
    }
  }
}
