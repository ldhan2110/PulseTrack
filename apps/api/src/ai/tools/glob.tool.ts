import { readdir } from 'fs/promises';
import { join, relative } from 'path';
import type { AiToolDef } from '../interfaces/ai-client.interface';
import type { ToolHandler } from '../tool-registry.service';

export const GLOB_DEF: AiToolDef = {
  name: 'glob',
  description: 'Find files matching a glob pattern in the workspace.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern to match files' },
    },
    required: ['pattern'],
  },
};

function matchGlob(pattern: string, filePath: string): boolean {
  const regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${regex}$`).test(filePath);
}

async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...(await walkDir(fullPath)));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

export function createGlobHandler(workspacePath: string): ToolHandler {
  return async (input) => {
    const pattern = input.pattern as string;
    const allFiles = await walkDir(workspacePath);
    const matched = allFiles
      .map((f) => relative(workspacePath, f))
      .filter((f) => matchGlob(pattern, f));
    return matched.join('\n') || 'No matches found.';
  };
}
