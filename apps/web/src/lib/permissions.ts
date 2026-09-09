export interface PermissionSet {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface RolePermissions {
  tasks: PermissionSet;
  bugs: PermissionSet;
  sprints: PermissionSet;
  testCases: PermissionSet;
  testExecutions: PermissionSet;
  members: PermissionSet;
  projectSettings: PermissionSet;
  dashboard: PermissionSet;
  comments: PermissionSet;
  attachments: PermissionSet;
  report: PermissionSet;
  wbs: PermissionSet;
  planner: PermissionSet;
  [key: string]: PermissionSet;
}

export type PermissionArea = keyof RolePermissions;
export type PermissionAction = keyof PermissionSet;

export const PERMISSION_AREAS: { key: PermissionArea; label: string }[] = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'bugs', label: 'Bugs' },
  { key: 'sprints', label: 'Sprints' },
  { key: 'testCases', label: 'Test Cases' },
  { key: 'testExecutions', label: 'Test Executions' },
  { key: 'members', label: 'Members' },
  { key: 'projectSettings', label: 'Project Settings' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'comments', label: 'Comments' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'report', label: 'Report' },
  { key: 'wbs', label: 'WBS' },
  { key: 'planner', label: 'Planner' },
];

export const PERMISSION_ACTIONS: PermissionAction[] = ['view', 'create', 'update', 'delete'];

export interface Permission {
  area: PermissionArea;
  action: PermissionAction;
}

/**
 * Typed area×action permission constants. Use instead of raw strings so
 * renames are compile-checked and typos impossible:
 *   <PermissionGate projectId={id} {...PERM.testCases.create}>
 */
export const PERM = Object.fromEntries(
  PERMISSION_AREAS.map(({ key }) => [
    key,
    Object.fromEntries(PERMISSION_ACTIONS.map((action) => [action, { area: key, action }])),
  ]),
) as Record<PermissionArea, Record<PermissionAction, Permission>>;

export function hasPermission(
  permissions: RolePermissions | null,
  area: string,
  action: string,
): boolean {
  if (!permissions) return false;
  const areaPerms = permissions[area];
  if (!areaPerms) return false;
  return areaPerms[action as PermissionAction] === true;
}
