import { readFile } from 'fs/promises';
import type { AiToolDef } from '../interfaces/ai-client.interface';
import type { ToolHandler } from '../tool-registry.service';
import { resolveSafePath } from './safe-path';

export const READ_FILE_DEF: AiToolDef = {
  name: 'read_file',
  description: 'Read the contents of a file at the given path.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative file path to read' },
    },
    required: ['path'],
  },
};

export function createReadFileHandler(workspacePath: string): ToolHandler {
  return async (input) => {
    const filePath = resolveSafePath(workspacePath, input.path as string);
    return await readFile(filePath, 'utf-8');
  };
}
