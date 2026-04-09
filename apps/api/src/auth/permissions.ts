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

const ALL_TRUE: PermissionSet = { view: true, create: true, update: true, delete: true };
const VIEW_ONLY: PermissionSet = { view: true, create: false, update: false, delete: false };
const ALL_FALSE: PermissionSet = { view: false, create: false, update: false, delete: false };

export const SYSTEM_ROLE_PERMISSIONS: RolePermissions = {
  tasks: ALL_TRUE,
  bugs: ALL_TRUE,
  sprints: ALL_TRUE,
  testCases: ALL_TRUE,
  testExecutions: ALL_TRUE,
  members: ALL_TRUE,
  projectSettings: ALL_TRUE,
  dashboard: ALL_TRUE,
  comments: ALL_TRUE,
  attachments: ALL_TRUE,
};

export const DEFAULT_MEMBER_PERMISSIONS: RolePermissions = {
  tasks: { view: true, create: true, update: true, delete: false },
  bugs: { view: true, create: true, update: true, delete: false },
  sprints: VIEW_ONLY,
  testCases: { view: true, create: true, update: true, delete: false },
  testExecutions: { view: true, create: true, update: true, delete: false },
  members: VIEW_ONLY,
  projectSettings: VIEW_ONLY,
  dashboard: VIEW_ONLY,
  comments: { view: true, create: true, update: true, delete: false },
  attachments: { view: true, create: true, update: false, delete: false },
};

export const EMPTY_PERMISSIONS: RolePermissions = {
  tasks: ALL_FALSE,
  bugs: ALL_FALSE,
  sprints: ALL_FALSE,
  testCases: ALL_FALSE,
  testExecutions: ALL_FALSE,
  members: ALL_FALSE,
  projectSettings: ALL_FALSE,
  dashboard: ALL_FALSE,
  comments: ALL_FALSE,
  attachments: ALL_FALSE,
};

export function hasPermission(
  permissions: RolePermissions,
  area: string,
  action: string,
): boolean {
  const areaPerms = permissions[area];
  if (!areaPerms) return false;
  return areaPerms[action as PermissionAction] === true;
}
