# Tasks: export-excel-sanitize-parent

## 1. Readable description [req-1]
- [x] 1.1 [service] Add private helper `sanitizeDescription(html: string): string` to `TasksService` (`apps/api/src/tasks/tasks.service.ts`) — strip tags with `/<[^>]*>/g`, decode entities `&amp; &lt; &gt; &quot; &#39; &nbsp;`, collapse whitespace to single space, trim
- [x] 1.2 [service] Apply it at the row build (`tasks.service.ts:745`): `description: this.sanitizeDescription(t.description ?? '')`
Verify: `cd apps/api && pnpm vitest run src/tasks/export-excel.spec.ts` (description scenarios pass)

## 2. Parent Task Key column [req-2]
- [x] 2.1 [service] In the flatten loop (`tasks.service.ts:688-697`), attach `parentKey`: parent rows → `''`, child rows → `task.taskKey ?? ''`
- [x] 2.2 [service] Add column def as the **second** column (`tasks.service.ts:704`): `{ header: 'Parent Task Key', key: 'parentKey', width: 16 }`
- [x] 2.3 [service] Set `parentKey` in the `addRow` object (`tasks.service.ts:742`)
Verify: `cd apps/api && pnpm vitest run src/tasks/export-excel.spec.ts` (parent-key + column-order scenarios pass)

## 3. Test [req-1, req-2]
- [x] 3.1 [test] New `apps/api/src/tasks/export-excel.spec.ts` — construct `TasksService` with a mocked `prisma.task.findMany` returning one parent (`taskKey: 'PROJ-1'`, `description: '<p>Ship A &amp; B when x &lt; y</p>'`) with one child (`taskKey: 'PROJ-1-1'`), call `exportExcel`, load the returned buffer with `ExcelJS` and assert:
  - parent Description cell === `Ship A & B when x < y`
  - header row order is `Task Key`, `Parent Task Key`, `Title`, `Description`, …
  - child `Parent Task Key` cell === `PROJ-1`, parent `Parent Task Key` cell === `` (empty)
Verify: `cd apps/api && pnpm vitest run src/tasks/export-excel.spec.ts`
