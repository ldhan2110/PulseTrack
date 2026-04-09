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
];

export const PERMISSION_ACTIONS: PermissionAction[] = ['view', 'create', 'update', 'delete'];

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
