import { utils, writeFile } from 'xlsx';
import type { TestCase } from './types';

interface ExportRow {
  ID: string;
  Title: string;
  Module: string;
  Priority: string;
  Status: string;
  Preconditions: string;
  'Expected Result': string;
  Steps: string;
  Tags: string;
  'Estimated Minutes': number | string;
}

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatSteps(steps?: { position: number; action: string }[]): string {
  if (!steps || steps.length === 0) return '';
  return steps
    .sort((a, b) => a.position - b.position)
    .map((s, i) => `${i + 1}. ${s.action}`)
    .join('\n');
}

function mapTestCaseToRow(tc: TestCase): ExportRow {
  return {
    ID: tc.testCaseKey ?? '',
    Title: tc.title,
    Module: tc.module?.name ?? '',
    Priority: tc.priority ? toTitleCase(tc.priority) : '',
    Status: toTitleCase(tc.status),
    Preconditions: tc.preconditions ?? '',
    'Expected Result': tc.expectedResult ?? '',
    Steps: formatSteps(tc.steps),
    Tags: tc.tags?.join(', ') ?? '',
    'Estimated Minutes': tc.estimatedMinutes ?? '',
  };
}

export function exportTestCasesToExcel(
  testCases: TestCase[],
  filename: string,
): void {
  const rows = testCases.map(mapTestCaseToRow);
  const worksheet = utils.json_to_sheet(rows);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, 'Test Cases');
  writeFile(workbook, filename);
}
