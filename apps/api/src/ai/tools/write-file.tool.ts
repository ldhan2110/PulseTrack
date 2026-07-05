import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import type { AiToolDef } from '../interfaces/ai-client.interface';
import type { ToolHandler } from '../tool-registry.service';
import { resolveSafePath } from './safe-path';

export const WRITE_FILE_DEF: AiToolDef = {
  name: 'write_file',
  description: 'Write content to a file at the given path, creating directories as needed.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative file path to write' },
      content: { type: 'string', description: 'File content to write' },
    },
    required: ['path', 'content'],
  },
};

export function createWriteFileHandler(workspacePath: string): ToolHandler {
  return async (input) => {
    const filePath = resolveSafePath(workspacePath, input.path as string);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, input.content as string, 'utf-8');
    return `Wrote ${filePath}`;
  };
}
