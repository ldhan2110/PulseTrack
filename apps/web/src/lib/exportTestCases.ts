import XLSX from 'xlsx-js-style';
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
  return [...steps]
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

const headerStyle: XLSX.CellStyle = {
  font: { bold: true },
  fill: { fgColor: { rgb: 'D9D9D9' } },
  border: {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  },
  alignment: { wrapText: true, vertical: 'center' },
};

const cellStyle: XLSX.CellStyle = {
  alignment: { wrapText: true, vertical: 'top' },
  border: {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  },
};

const columnWidths = [
  { wch: 14 },  // ID
  { wch: 40 },  // Title
  { wch: 20 },  // Module
  { wch: 12 },  // Priority
  { wch: 12 },  // Status
  { wch: 30 },  // Preconditions
  { wch: 30 },  // Expected Result
  { wch: 40 },  // Steps
  { wch: 20 },  // Tags
  { wch: 16 },  // Estimated Minutes
];

export function exportTestCasesToExcel(
  testCases: TestCase[],
  filename: string,
): void {
  const rows = testCases.map(mapTestCaseToRow);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = columnWidths;

  // Apply styles to all cells
  const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1');
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellRef];
      if (!cell) continue;
      cell.s = row === 0 ? headerStyle : cellStyle;
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Cases');
  XLSX.writeFile(workbook, filename);
}
