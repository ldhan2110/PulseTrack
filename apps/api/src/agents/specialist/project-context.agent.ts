import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDeepAgent } from 'deepagents';
import { PrismaService } from '../../prisma/prisma.service';
import { buildRepoFingerprint } from '../../ai-config/repo-fingerprint.util';
import type { Agent } from '../agent.interface';
import { modelFor } from '../ai-client';
import { gitnexusMcpTools } from '../mcp/gitnexus-mcp.client';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts/project-context.prompt';

const CONTEXT_MAX_LENGTH = 10000;

export interface ProjectContextCtx {
  projectId: string;
}

@Injectable()
export class ProjectContextAgent implements Agent {
  readonly kind = 'project-context';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async run(ctx: unknown): Promise<string> {
    const { projectId } = ctx as ProjectContextCtx;

    const cfg = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!cfg) throw new NotFoundException('AI config not found. Save AI settings first.');

    const repos = await this.prisma.repository.findMany({
      where: { projectId, cloneStatus: 'cloned' },
    });
    if (repos.length === 0) throw new BadRequestException('Clone a repository first');

    const fingerprints = (
      await Promise.all(repos.map((r) => buildRepoFingerprint(r.workspacePath ?? '', r.name)))
    ).filter((f): f is string => f !== null);
    if (fingerprints.length === 0) throw new BadRequestException('Clone a repository first');

    const model = modelFor(cfg, this.config.getOrThrow<string>('ENCRYPTION_KEY'));

    // If any repo is indexed, let the model drill into the code graph via
    // GitNexus MCP tools (pass repo name as the `repo` arg). Fall back to the
    // plain fingerprint summary if nothing is indexed or the tools fail to load.
    const indexedNames = repos.filter((r) => r.indexStatus === 'indexed').map((r) => r.name);
    if (indexedNames.length > 0) {
      try {
        const { tools, close } = await gitnexusMcpTools();
        try {
          const agent = createDeepAgent({
            model,
            tools,
            systemPrompt:
              SYSTEM_PROMPT +
              `\n\nYou also have GitNexus code-graph tools. Indexed repos: ` +
              `${indexedNames.join(', ')}. Pass the repo name as the \`repo\` argument ` +
              `to inspect structure, call graphs, and impact before writing the summary.`,
          });
          const res = await agent.invoke(
            { messages: [{ role: 'user', content: buildUserPrompt(fingerprints) }] },
            { recursionLimit: 40 },
          );
          const msgs = res.messages;
          const last = msgs[msgs.length - 1];
          const text =
            typeof last.content === 'string'
              ? last.content
              : last.content.map((c: any) => (c.type === 'text' ? c.text : '')).join('');
          return text.slice(0, CONTEXT_MAX_LENGTH);
        } finally {
          await close();
        }
      } catch {
        // Tools unavailable (e.g. gitnexus not installed) — fall through to plain path.
      }
    }

    const response = await model.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(fingerprints) },
    ]);
    const raw = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c: any) => (typeof c === 'string' ? c : ('text' in c ? c.text : ''))).join('')
        : String(response.content);
    return raw.slice(0, CONTEXT_MAX_LENGTH);
  }
}
