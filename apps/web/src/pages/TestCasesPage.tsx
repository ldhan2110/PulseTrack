import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import type { ColumnFiltersState, SortingState } from '@tanstack/react-table';
import { ClipboardList, Search, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTestCases } from '@/hooks/useTestCases';
import { useTestModules } from '@/hooks/useTestModules';
import { ModuleTree } from '@/components/test-cases/ModuleTree';
import { TestCasesTable } from '@/components/test-cases/TestCasesTable';
import { TestCaseForm } from '@/components/test-cases/TestCaseForm';
import { SuiteManager } from '@/components/test-cases/SuiteManager';
import { ImportTestCasesDialog } from '@/components/test-cases/ImportTestCasesDialog';
import type { TestCase } from '@/lib/types';

export function TestCasesPage() {
  const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [suiteManagerOpen, setSuiteManagerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Build query filters
  const filters: Record<string, string> = {};
  if (selectedModuleId) filters.moduleId = selectedModuleId;
  if (selectedSuiteId) filters.suiteId = selectedSuiteId;
  if (search) filters.search = search;
  if (statusFilter) filters.status = statusFilter;
  if (priorityFilter) filters.priority = priorityFilter;

  const { data: testCases, isLoading } = useTestCases(projectId, Object.keys(filters).length > 0 ? filters : undefined);
  const { data: modules = [] } = useTestModules(projectId);

  const caseList = (testCases ?? []) as TestCase[];

  const handleEditCase = (tc: TestCase) => {
    setEditingCase(tc);
    setCreateOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setCreateOpen(open);
    if (!open) setEditingCase(null);
  };

  const handleSelectSuite = (id: string | null) => {
    setSelectedSuiteId(id);
    if (id) setSuiteManagerOpen(true);
  };

  // Empty state
  if (!isLoading && caseList.length === 0 && !selectedModuleId && !selectedSuiteId && !search && !statusFilter && !priorityFilter) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Test Cases</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="size-3.5 mr-1.5" />
              Import Excel
            </Button>
            <Button onClick={() => setCreateOpen(true)}>+ New Test Case</Button>
          </div>
        </div>
        <div className="flex">
          <div className="w-60 border-r pr-2 shrink-0">
            <ModuleTree
              projectId={projectId}
              selectedModuleId={selectedModuleId}
              onSelectModule={setSelectedModuleId}
              selectedSuiteId={selectedSuiteId}
              onSelectSuite={handleSelectSuite}
            />
          </div>
          <div className="flex-1 flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
              <ClipboardList className="size-12 text-muted-foreground" />
              <div>
                <h2 className="text-[20px] font-semibold">No test cases yet</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Create modules and test cases to start managing your test coverage.
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)}>+ New Test Case</Button>
            </div>
          </div>
        </div>
        <TestCaseForm
          open={createOpen}
          onOpenChange={handleFormClose}
          projectId={projectId}
          modules={modules}
          editingCase={editingCase}
        />
        {selectedSuiteId && (
          <SuiteManager
            open={suiteManagerOpen}
            onOpenChange={setSuiteManagerOpen}
            projectId={projectId}
            suiteId={selectedSuiteId}
          />
        )}
        <ImportTestCasesDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          projectId={projectId}
          modules={modules}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Test Cases</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="size-3.5 mr-1.5" />
            Import Excel
          </Button>
          <Button onClick={() => setCreateOpen(true)}>+ New Test Case</Button>
        </div>
      </div>

      <div className="flex gap-0 min-h-0 flex-1">
        {/* Left sidebar */}
        <div className="w-60 border-r pr-2 shrink-0">
          <ModuleTree
            projectId={projectId}
            selectedModuleId={selectedModuleId}
            onSelectModule={setSelectedModuleId}
            selectedSuiteId={selectedSuiteId}
            onSelectSuite={handleSelectSuite}
          />
        </div>

        {/* Right content */}
        <div className="flex-1 pl-4 flex flex-col gap-4">
          {/* Filters row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-[280px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search test cases..."
                className="h-8 pl-7 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val === 'ALL' ? '' : val)}>
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="DEPRECATED">Deprecated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val === 'ALL' ? '' : val)}>
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All priorities</SelectItem>
                <SelectItem value="BLOCKER">Blocker</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TestCasesTable
            testCases={caseList}
            projectId={projectId}
            isLoading={isLoading}
            onEditCase={handleEditCase}
            sorting={sorting}
            onSortingChange={setSorting}
            columnFilters={columnFilters}
            onColumnFiltersChange={setColumnFilters}
            globalFilter={globalFilter}
            onGlobalFilterChange={setGlobalFilter}
          />
        </div>
      </div>

      <TestCaseForm
        open={createOpen}
        onOpenChange={handleFormClose}
        projectId={projectId}
        modules={modules}
        editingCase={editingCase}
      />

      {selectedSuiteId && (
        <SuiteManager
          open={suiteManagerOpen}
          onOpenChange={setSuiteManagerOpen}
          projectId={projectId}
          suiteId={selectedSuiteId}
        />
      )}
      <ImportTestCasesDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
        modules={modules}
      />
    </div>
  );
}
