// Per-project task-form field visibility.
// Config is a { <fieldKey>: boolean } map; a missing config or missing key means visible.

export type FieldKey =
  | 'taskType'
  | 'assignee'
  | 'priority'
  | 'sprint'
  | 'storyPoints'
  | 'plannedStartDate'
  | 'plannedEndDate'
  | 'actualStartDate'
  | 'actualEndDate';

export type FieldConfig = Partial<Record<FieldKey, boolean>>;

export interface FieldDef {
  key: FieldKey;
  label: string;
  required?: boolean;
}

// Single source of truth for the field list shown in the config dialog
// and gated in the task forms.
export const FIELD_DEFS: FieldDef[] = [
  { key: 'taskType', label: 'Ticket type', required: true },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'sprint', label: 'Sprint' },
  { key: 'storyPoints', label: 'Story points' },
  { key: 'plannedStartDate', label: 'Planned start date' },
  { key: 'plannedEndDate', label: 'Planned end date' },
  { key: 'actualStartDate', label: 'Actual start date' },
  { key: 'actualEndDate', label: 'Actual end date' },
];

// Missing config or missing key => visible (default-on).
export function isFieldVisible(cfg: FieldConfig | null | undefined, key: FieldKey): boolean {
  return cfg?.[key] !== false;
}
