import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import type { ColumnFiltersState, SortingState } from '@tanstack/react-table';
import { Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBugs } from '@/hooks/useBugs';
import { useMembers } from '@/hooks/useMembers';
import { usePermissions } from '@/hooks/usePermissions';
import { BugsTable } from '@/components/bugs/BugsTable';
import { BugFilters } from '@/components/bugs/BugFilters';
import { CreateBugDialog } from '@/components/bugs/CreateBugDialog';
import { ImportBugsDialog } from '@/components/bugs/ImportBugsDialog';

export function BugsPage() {
  const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const { data: bugs, isLoading } = useBugs(projectId);
  const { data: members = [] } = useMembers(projectId);
  const { can } = usePermissions(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Filter/sort state owned at page level so filters wire into the table
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const canReport = can('bugs', 'create');

  const bugList = bugs ?? [];

  if (!isLoading && bugList.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Bugs</h1>
          {canReport && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>Import from Excel</Button>
              <Button onClick={() => setCreateOpen(true)}>Report Bug</Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
            <Bug className="size-12 text-muted-foreground" />
            <div>
              <h2 className="text-[20px] font-semibold">No bugs reported</h2>
              <p className="text-sm text-muted-foreground mt-1">
                When bugs are found, they will appear here for tracking.
              </p>
            </div>
            {canReport && (
              <Button onClick={() => setCreateOpen(true)}>Report Bug</Button>
            )}
          </div>
        </div>
        <CreateBugDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId}
          members={members}
        />
        <ImportBugsDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          projectId={projectId}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Bugs</h1>
        {canReport && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>Import from Excel</Button>
            <Button onClick={() => setCreateOpen(true)}>Report Bug</Button>
          </div>
        )}
      </div>

      <BugFilters
        projectId={projectId}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        members={members}
      />

      <BugsTable
        bugs={bugList}
        projectId={projectId}
        projectPrefix={projectPrefix}
        isLoading={isLoading}
        sorting={sorting}
        onSortingChange={setSorting}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
      />

      <CreateBugDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        members={members}
      />
      <ImportBugsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
      />
    </div>
  );
}
