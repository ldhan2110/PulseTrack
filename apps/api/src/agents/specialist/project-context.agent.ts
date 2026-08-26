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

/** Static, arg-free progress labels keyed by tool name. Unknown → generic. */
const TOOL_LABELS: Record<string, string> = {
  list_repos: '🔍 Scanning the repository…',
  query: '🗄 Querying the code domain…',
  cypher: '🗄 Querying the code domain…',
  context: '🔍 Reading code context…',
  detect_changes: '🔍 Scanning the repository…',
  impact: '🔍 Analyzing impact…',
  explain: '🔍 Reading code context…',
  trace: '🔍 Tracing code paths…',
};

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

  async run(ctx: unknown, onStep?: (line: string) => void): Promise<string> {
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
          let text = '';
          let writeAnnounced = false;
          const stream = await agent.streamEvents(
            { messages: [{ role: 'user', content: buildUserPrompt(fingerprints) }] },
            { version: 'v2', recursionLimit: 40 },
          );
          for await (const ev of stream) {
            if (ev.event === 'on_tool_start') {
              onStep?.(TOOL_LABELS[ev.name] ?? '⚙ Working…');
            } else if (ev.event === 'on_chat_model_start') {
              text = '';
            } else if (ev.event === 'on_chat_model_stream') {
              if (!writeAnnounced) {
                writeAnnounced = true;
                onStep?.('✍️ Writing context…');
              }
              const content = ev.data?.chunk?.content;
              if (typeof content === 'string') text += content;
              else if (Array.isArray(content))
                text += content.map((c: any) => (c.type === 'text' ? c.text : '')).join('');
            }
          }
          return text.slice(0, CONTEXT_MAX_LENGTH);
        } finally {
          await close();
        }
      } catch {
        // Tools unavailable (e.g. gitnexus not installed) — fall through to plain path.
      }
    }

    onStep?.('🔍 Analyzing repositories…');
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
