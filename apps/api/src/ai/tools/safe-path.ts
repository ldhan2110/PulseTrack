import { resolve } from 'path';

export function resolveSafePath(
  workspacePath: string,
  relativePath: string,
): string {
  const resolved = resolve(workspacePath, relativePath);
  if (!resolved.startsWith(workspacePath)) {
    throw new Error(`Path traversal blocked: ${relativePath}`);
  }
  return resolved;
}
