// TODO: implement
export function usePermissions(_projectId: string) {
  const can = (_resource: string, _action: string) => true;
  return { can };
}
