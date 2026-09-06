import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAgent } from 'langchain';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { mkdir, writeFile } from 'fs/promises';
import { join, normalize, isAbsolute } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import type { Agent } from '../agent.interface';
import { modelFor } from '../ai-client';
import { codegraphMcpTools } from '../mcp/codegraph-mcp.client';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts/wiki.prompt';

export interface WikiCtx {
  projectId: string;
  section: string;
  repoPaths: string[];
  sectionDir: string;
  signal?: AbortSignal;
}

/** Static, arg-free progress labels keyed by tool name. */
const TOOL_LABELS: Record<string, string> = {
  list_repos: '🔍 Scanning repositories…',
  query: '🗄 Querying the code graph…',
  cypher: '🗄 Querying the code graph…',
  context: '🔍 Reading code context…',
  detect_changes: '🔍 Scanning changes…',
  impact: '🔍 Analyzing impact…',
  explain: '🔍 Reading code context…',
  trace: '🔍 Tracing code paths…',
};

@Injectable()
export class WikiAgent implements Agent {
  readonly kind = 'wiki';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Returns the number of pages written for the section. */
  async run(ctx: unknown, onStep?: (line: string) => void): Promise<number> {
    const { projectId, section, repoPaths, sectionDir, signal } = ctx as WikiCtx;

    const cfg = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!cfg) throw new BadRequestException('Configure AI settings first.');

    const model = modelFor(cfg, this.config.getOrThrow<string>('ENCRYPTION_KEY'));

    let pages = 0;
    const writeFileTool = tool(
      async ({ path, content }: { path: string; content: string }) => {
        // Contain writes to the section dir — reject absolute paths and traversal.
        const rel = normalize(path);
        if (isAbsolute(rel) || rel.startsWith('..')) {
          return `Rejected path "${path}": must be relative and inside the section directory.`;
        }
        const full = join(sectionDir, rel);
        await mkdir(join(full, '..'), { recursive: true });
        await writeFile(full, content, 'utf-8');
        pages += 1;
        onStep?.(`📝 Wrote ${section}/${rel}`);
        return `Wrote ${rel}`;
      },
      {
        name: 'write_file',
        description:
          'Write one markdown wiki page. `path` is relative to the section directory ' +
          '(e.g. "index.md" or "services/auth.md"). Creates parent directories.',
        schema: z.object({
          path: z.string().describe('Page path relative to the section directory'),
          content: z.string().describe('Full markdown content of the page'),
        }),
      },
    );

    const { tools, close } = await codegraphMcpTools();
    try {
      const agent = createAgent({
        model,
        // MCP tools + local write tool; mixed array widens the inferred type.
        tools: [...tools, writeFileTool] as any,
        systemPrompt: SYSTEM_PROMPT,
      });

      const stream = await agent.streamEvents(
        { messages: [{ role: 'user', content: buildUserPrompt(section, repoPaths) }] },
        { version: 'v2', recursionLimit: 60, signal },
      );
      for await (const ev of stream) {
        if (ev.event === 'on_tool_start' && ev.name !== 'write_file') {
          onStep?.(TOOL_LABELS[ev.name] ?? '⚙ Working…');
        }
      }
      return pages;
    } finally {
      await close();
    }
  }
}
