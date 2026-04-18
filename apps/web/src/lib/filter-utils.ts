import type { ColumnFiltersState } from '@tanstack/react-table';
import type { SavedFilterData } from './types';

export function savedFilterDataToColumnFilters(data: SavedFilterData): {
  columnFilters: ColumnFiltersState;
  globalFilter: string;
} {
  const columnFilters: ColumnFiltersState = [];
  if (data.statuses && data.statuses.length > 0) {
    columnFilters.push({ id: 'workflowStatusId', value: data.statuses });
  }
  if (data.assignees && data.assignees.length > 0) {
    columnFilters.push({ id: 'assigneeId', value: data.assignees });
  }
  if (data.sprint) {
    columnFilters.push({ id: 'sprintId', value: data.sprint });
  }
  if (data.progress && data.progress.length > 0) {
    columnFilters.push({ id: 'progress', value: data.progress });
  }
  return { columnFilters, globalFilter: data.search ?? '' };
}

export function columnFiltersToSavedFilterData(
  filters: ColumnFiltersState,
  globalFilter: string,
): SavedFilterData {
  const data: SavedFilterData = {};
  for (const f of filters) {
    switch (f.id) {
      case 'workflowStatusId': data.statuses = f.value as string[]; break;
      case 'assigneeId': data.assignees = f.value as string[]; break;
      case 'sprintId': data.sprint = f.value as string; break;
      case 'progress': data.progress = f.value as string[]; break;
    }
  }
  if (globalFilter) data.search = globalFilter;
  return data;
}
