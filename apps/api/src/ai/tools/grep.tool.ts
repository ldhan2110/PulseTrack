import { exec } from 'child_process';
import { promisify } from 'util';
import type { AiToolDef } from '../interfaces/ai-client.interface';
import type { ToolHandler } from '../tool-registry.service';

const execAsync = promisify(exec);

export const GREP_DEF: AiToolDef = {
  name: 'grep',
  description: 'Search for a pattern in files within the workspace.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex pattern to search for' },
      glob: { type: 'string', description: 'Optional file glob filter (e.g. "*.ts")' },
    },
    required: ['pattern'],
  },
};

export function createGrepHandler(workspacePath: string): ToolHandler {
  return async (input) => {
    const pattern = input.pattern as string;
    const fileGlob = input.glob as string | undefined;

    const includeFlag = fileGlob ? ` --include='${fileGlob}'` : '';
    const cmd = `grep -rn${includeFlag} -- ${JSON.stringify(pattern)} .`;

    try {
      const { stdout } = await execAsync(cmd, {
        cwd: workspacePath,
        maxBuffer: 1024 * 1024,
        timeout: 30_000,
      });
      return stdout || 'No matches found.';
    } catch (err: unknown) {
      const execErr = err as { code?: number; stdout?: string };
      if (execErr.code === 1) {
        return 'No matches found.';
      }
      throw err;
    }
  };
}
