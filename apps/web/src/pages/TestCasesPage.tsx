import { useState, useEffect } from 'react';

import { useUiStore } from '@/store/uiStore';
import type { ColumnFiltersState, SortingState, RowSelectionState } from '@tanstack/react-table';
import { useParams } from 'react-router-dom';
import { ClipboardList, Search, FileSpreadsheet, Download, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTestCases, useBulkDeleteTestCases } from '@/hooks/useTestCases';
import { useTestModules } from '@/hooks/useTestModules';
import { ModuleTree } from '@/components/test-cases/ModuleTree';
import { TestCasesTable } from '@/components/test-cases/TestCasesTable';
import { TestCaseForm } from '@/components/test-cases/TestCaseForm';
import { SuiteManager } from '@/components/test-cases/SuiteManager';
import { ImportTestCasesDialog } from '@/components/test-cases/ImportTestCasesDialog';
import { ExportTestCasesDialog } from '@/components/test-cases/ExportTestCasesDialog';
import type { TestCase } from '@/lib/types';
import { GenerateTestCasesModal } from '@/components/test-cases/GenerateTestCasesModal';
import { TestCaseGenerationWizard } from '@/components/test-cases/TestCaseGenerationWizard';
import { useAiTestCaseGeneration } from '@/hooks/useAiTestCaseGeneration';
import { useAiConfig } from '@/hooks/useAiConfig';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRepositoryConfig } from '@/hooks/useRepositoryConfig';
import type { Task } from '@/lib/types';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export function TestCasesPage() {
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
  const [exportOpen, setExportOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { projectPrefix } = useParams<{ projectPrefix: string }>();

  const { data: aiConfig } = useAiConfig(projectId);
  const { data: repoConfig } = useRepositoryConfig(projectId);
  const canGenerate = !!aiConfig && repoConfig?.cloneStatus === 'cloned';

  const aiGeneration = useAiTestCaseGeneration(projectId);
  const bulkDelete = useBulkDeleteTestCases(projectId);

  // Fetch project tasks for the modal task selector
  const { data: projectTasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.getTasks(projectId),
    enabled: !!projectId && generateOpen,
  });

  const handleGenerateSubmit = (formData: FormData) => {
    aiGeneration.generate.mutate(formData);
  };

  // Auto-open wizard when generation completes
  useEffect(() => {
    if (aiGeneration.isCompleted && !wizardOpen && generateOpen) {
      setGenerateOpen(false);
      setWizardOpen(true);
    }
  }, [aiGeneration.isCompleted, wizardOpen, generateOpen]);

  const handleWizardClose = (open: boolean) => {
    setWizardOpen(open);
    if (!open) aiGeneration.reset();
  };

  const handleGenerateClose = (open: boolean) => {
    setGenerateOpen(open);
    if (!open && !aiGeneration.isCompleted) aiGeneration.reset();
  };

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

  const selectedIds = Object.keys(rowSelection)
    .filter((key) => rowSelection[key])
    .map((key) => caseList[parseInt(key)]?.id)
    .filter(Boolean) as string[];

  const handleBulkDelete = () => {
    bulkDelete.mutate(selectedIds, {
      onSuccess: () => {
        setRowSelection({});
        setConfirmDeleteOpen(false);
      },
    });
  };

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

  const toolbarActions = (
    <div className="flex items-center gap-2">
      {canGenerate && (
        <Button variant="outline" onClick={() => setGenerateOpen(true)}>
          <Sparkles className="size-3.5 mr-1.5" />
          AI Generate
        </Button>
      )}
      <Button variant="outline" onClick={() => setImportOpen(true)}>
        <FileSpreadsheet className="size-3.5 mr-1.5" />
        Import Excel
      </Button>
      <Button variant="outline" onClick={() => setExportOpen(true)}>
        <Download className="size-3.5 mr-1.5" />
        Export Excel
      </Button>
      <Button onClick={() => setCreateOpen(true)}>+ New Test Case</Button>
    </div>
  );

  // Empty state
  if (!isLoading && caseList.length === 0 && !selectedModuleId && !selectedSuiteId && !search && !statusFilter && !priorityFilter) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Test Cases</h1>
          {toolbarActions}
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
        <ExportTestCasesDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          projectId={projectId}
          projectPrefix={projectPrefix}
        />
        <GenerateTestCasesModal
          open={generateOpen}
          onOpenChange={handleGenerateClose}
          tasks={projectTasks as Task[]}
          isProcessing={aiGeneration.isLoading}
          step={aiGeneration.step}
          error={aiGeneration.error}
          rawText={aiGeneration.rawText}
          onSubmit={handleGenerateSubmit}
          onCancel={aiGeneration.cancel}
          onRetry={aiGeneration.retry}
        />
        {wizardOpen && aiGeneration.testCases.length > 0 && (
          <TestCaseGenerationWizard
            open={wizardOpen}
            onOpenChange={handleWizardClose}
            testCases={aiGeneration.testCases}
            projectId={projectId}
            modules={modules}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Test Cases</h1>
        {toolbarActions}
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
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
          />
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-card shadow-lg rounded-lg px-4 py-3 border">
            <span className="text-sm font-medium">
              {selectedIds.length} test case{selectedIds.length !== 1 ? 's' : ''} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDeleteOpen(true)}
              className="h-8 gap-1.5"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRowSelection({})}
              className="h-8"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete test cases</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.length} test case
              {selectedIds.length !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      <ExportTestCasesDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        projectId={projectId}
        projectPrefix={projectPrefix}
      />
      <GenerateTestCasesModal
        open={generateOpen}
        onOpenChange={handleGenerateClose}
        tasks={projectTasks as Task[]}
        isProcessing={aiGeneration.isLoading}
        step={aiGeneration.step}
        error={aiGeneration.error}
        rawText={aiGeneration.rawText}
        onSubmit={handleGenerateSubmit}
        onCancel={aiGeneration.cancel}
        onRetry={aiGeneration.retry}
      />
      {wizardOpen && aiGeneration.testCases.length > 0 && (
        <TestCaseGenerationWizard
          open={wizardOpen}
          onOpenChange={handleWizardClose}
          testCases={aiGeneration.testCases}
          projectId={projectId}
          modules={modules}
        />
      )}
    </div>
  );
}
