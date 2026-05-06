import type { SortingState, ColumnFiltersState, RowSelectionState, OnChangeFn } from '@tanstack/react-table';
import type { TestExecution } from '@/lib/types';

interface ExecutionListProps {
  executions: TestExecution[];
  onSelectExecution: (id: string) => void;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
}

// TODO: implement
export function ExecutionList(_props: ExecutionListProps) {
  return <div>ExecutionList placeholder</div>;
}
