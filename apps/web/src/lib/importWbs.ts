import XLSX from 'xlsx-js-style';
import type { BulkCreateWbsPhasePayload, BulkCreateWbsTaskPayload, BulkCreateWbsSubtaskPayload } from './types';

export interface ImportPreviewRow {
  level: 0 | 1 | 2;
  title: string;
  planStart: string | null;
  planEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  error?: string;
}

export interface ImportParseResult {
  previewRows: ImportPreviewRow[];
  payload: { phases: BulkCreateWbsPhasePayload[] };
  errors: number;
}

/** Parse DD/MM/YYYY or YYYY-MM-DD → ISO YYYY-MM-DD, "—" or empty → null */
function parseDateCell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str || str === '\u2014' || str === '-') return null;

  // DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m}-${d}`;
  }

  // YYYY-MM-DD (ISO)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return str.slice(0, 10);
  }

  return null;
}

/** Parse progress: "45%" → 45, "45" → 45, null/empty → 0 */
function parseProgress(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim().replace('%', '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
}

/** Detect hierarchy level from leading whitespace: 0=Phase, 2=Task, 4=Subtask */
function detectLevel(raw: string): { level: 0 | 1 | 2; title: string } {
  const leadingSpaces = raw.length - raw.trimStart().length;
  const title = raw.trim();
  if (leadingSpaces >= 4) return { level: 2, title };
  if (leadingSpaces >= 2) return { level: 1, title };
  return { level: 0, title };
}

export function parseWbsExcel(file: ArrayBuffer): ImportParseResult {
  const workbook = XLSX.read(file, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { previewRows: [], payload: { phases: [] }, errors: 0 };
  }

  const worksheet = workbook.Sheets[sheetName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  // Skip 2 header rows (row 0 = month headers, row 1 = day numbers)
  const dataRows = raw.slice(2);

  const previewRows: ImportPreviewRow[] = [];
  const phases: BulkCreateWbsPhasePayload[] = [];

  // Track current phase/task for hierarchy
  let currentPhase: BulkCreateWbsPhasePayload | null = null;
  let currentTask: BulkCreateWbsTaskPayload | null = null;

  for (const row of dataRows) {
    // Column layout: 0=Task, 1=Plan Start, 2=Plan End, 3=Actual Start, 4=Actual End, 5=Progress
    const rawTitle = row[0];
    if (rawTitle === null || rawTitle === undefined || String(rawTitle).trim() === '') {
      continue;
    }

    const titleStr = String(rawTitle);
    const { level, title } = detectLevel(titleStr);

    const planStart = parseDateCell(row[1]);
    const planEnd = parseDateCell(row[2]);
    const actualStart = parseDateCell(row[3]);
    const actualEnd = parseDateCell(row[4]);
    const progress = parseProgress(row[5]);

    const previewRow: ImportPreviewRow = {
      level,
      title,
      planStart,
      planEnd,
      actualStart,
      actualEnd,
      progress,
    };

    if (level === 0) {
      // Phase
      currentPhase = {
        title,
        planStart: planStart ?? undefined,
        planEnd: planEnd ?? undefined,
        actualStart: actualStart ?? undefined,
        actualEnd: actualEnd ?? undefined,
        progress,
        tasks: [],
      };
      currentTask = null;
      phases.push(currentPhase);
    } else if (level === 1) {
      // Task — create implicit parent phase if none exists
      if (!currentPhase) {
        currentPhase = {
          title: 'Untitled Phase',
          tasks: [],
        };
        phases.push(currentPhase);
        previewRows.push({
          level: 0,
          title: 'Untitled Phase',
          planStart: null,
          planEnd: null,
          actualStart: null,
          actualEnd: null,
          progress: 0,
          error: 'Auto-created implicit phase',
        });
      }

      currentTask = {
        title,
        planStart: planStart ?? undefined,
        planEnd: planEnd ?? undefined,
        actualStart: actualStart ?? undefined,
        actualEnd: actualEnd ?? undefined,
        progress,
        subtasks: [],
      };
      if (!currentPhase.tasks) currentPhase.tasks = [];
      currentPhase.tasks.push(currentTask);
    } else {
      // Subtask — create implicit parent phase/task if none exist
      if (!currentPhase) {
        currentPhase = {
          title: 'Untitled Phase',
          tasks: [],
        };
        phases.push(currentPhase);
        previewRows.push({
          level: 0,
          title: 'Untitled Phase',
          planStart: null,
          planEnd: null,
          actualStart: null,
          actualEnd: null,
          progress: 0,
          error: 'Auto-created implicit phase',
        });
      }

      if (!currentTask) {
        currentTask = {
          title: 'Untitled Task',
          subtasks: [],
        };
        if (!currentPhase.tasks) currentPhase.tasks = [];
        currentPhase.tasks.push(currentTask);
        previewRows.push({
          level: 1,
          title: 'Untitled Task',
          planStart: null,
          planEnd: null,
          actualStart: null,
          actualEnd: null,
          progress: 0,
          error: 'Auto-created implicit task',
        });
      }

      const subtask: BulkCreateWbsSubtaskPayload = {
        title,
        planStart: planStart ?? undefined,
        planEnd: planEnd ?? undefined,
        actualStart: actualStart ?? undefined,
        actualEnd: actualEnd ?? undefined,
        progress,
      };
      if (!currentTask.subtasks) currentTask.subtasks = [];
      currentTask.subtasks.push(subtask);
    }

    previewRows.push(previewRow);
  }

  const errors = previewRows.filter((r) => r.error).length;

  return {
    previewRows,
    payload: { phases },
    errors,
  };
}
