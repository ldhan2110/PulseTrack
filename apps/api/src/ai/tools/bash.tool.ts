import { exec } from 'child_process';
import { promisify } from 'util';
import type { AiToolDef } from '../interfaces/ai-client.interface';
import type { ToolHandler } from '../tool-registry.service';

const execAsync = promisify(exec);

export const BASH_DEF: AiToolDef = {
  name: 'bash',
  description: 'Execute a shell command in the workspace directory.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
    },
    required: ['command'],
  },
};

export function createBashHandler(workspacePath: string): ToolHandler {
  return async (input) => {
    const timeout = (input.timeout as number) || 30_000;
    const { stdout, stderr } = await execAsync(input.command as string, {
      cwd: workspacePath,
      timeout,
      maxBuffer: 1024 * 1024,
    });
    return [stdout, stderr].filter(Boolean).join('\n');
  };
}
