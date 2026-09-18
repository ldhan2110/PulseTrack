import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { TasksService } from './tasks.service';

// exportExcel only touches prisma; other injected deps are unused here.
function makeService(findManyResult: any[]) {
  const prisma = { task: { findMany: vi.fn().mockResolvedValue(findManyResult) } } as any;
  return new TasksService(prisma, undefined as any, undefined as any, undefined as any);
}

async function loadSheet(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  return wb.getWorksheet('Tasks')!;
}

describe('TasksService.exportExcel', () => {
  it('sanitizes description HTML and adds Parent Task Key column', async () => {
    const service = makeService([
      {
        taskKey: 'PROJ-1',
        title: 'Parent',
        description: '<p>Ship A &amp; B when x &lt; y</p>',
        children: [{ taskKey: 'PROJ-1-1', title: 'Child', description: '' }],
      },
    ]);

    const buffer = await service.exportExcel('p1', {});
    const sheet = await loadSheet(buffer);

    const headers = (sheet.getRow(1).values as any[]).slice(1, 5);
    expect(headers).toEqual(['Task Key', 'Parent Task Key', 'Title', 'Description']);

    // reloaded workbook drops column keys, so index by column number:
    // 1=Task Key, 2=Parent Task Key, 3=Title, 4=Description
    // row 2 = parent, row 3 = child
    expect(sheet.getRow(2).getCell(4).value).toBe('Ship A & B when x < y');
    expect(sheet.getRow(2).getCell(2).value ?? '').toBe('');
    expect(sheet.getRow(3).getCell(2).value).toBe('PROJ-1');
  });

  it('leaves an empty description empty', async () => {
    const service = makeService([{ taskKey: 'PROJ-2', title: 'No desc', description: null, children: [] }]);
    const buffer = await service.exportExcel('p1', {});
    const sheet = await loadSheet(buffer);
    expect(sheet.getRow(2).getCell(4).value ?? '').toBe('');
  });
});
