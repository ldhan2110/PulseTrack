import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDeepAgent } from 'deepagents';
import { PrismaService } from '../../prisma/prisma.service';
import type { Agent } from '../agent.interface';
import { modelFor } from '../ai-client';
import { gitnexusMcpTools } from '../mcp/gitnexus-mcp.client';
import { buildSkillIndex, buildSkillTools } from '../tools/skill.tools';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts/ba-user-story.prompt';

export interface BaUserStoryCtx {
  projectId: string;
  prompt: string;
  breakIntoSubTasks: boolean;
  documents?: string[];
}

export interface GeneratedTask {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  storyPoints: number;
  subTasks?: GeneratedTask[];
}

/** Static, arg-free progress labels keyed by tool name. Unknown → generic. */
const TOOL_LABELS: Record<string, string> = {
  load_skill: '📖 Loading a project skill…',
  list_repos: '🔍 Scanning the repository…',
  query: '🗄 Querying the code domain…',
  cypher: '🗄 Querying the code domain…',
  context: '🔍 Reading code context…',
  detect_changes: '🔍 Scanning the repository…',
  check: '🔍 Scanning the repository…',
  impact: '🔍 Analyzing impact…',
  explain: '🔍 Reading code context…',
  pdg_query: '🗄 Querying the code domain…',
  route_map: '🗺 Mapping routes…',
  tool_map: '🗺 Mapping tools…',
  shape_check: '🔍 Scanning the repository…',
  api_impact: '🔍 Analyzing impact…',
  group_list: '🔍 Scanning the repository…',
  trace: '🔍 Tracing code paths…',
};

/** Pull the first fenced JSON block (or the raw text) and parse it as tasks. */
function parseTasks(text: string): GeneratedTask[] {
  const t = text.trim();
  const fenced = t.match(/```(?:json)?\n([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : t).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('AI did not return parseable tasks.');
  }
  if (!Array.isArray(parsed)) {
    throw new BadRequestException('AI task output was not a list.');
  }
  return parsed as GeneratedTask[];
}

/** Non-throwing parse for salvage: returns tasks or null when unparseable. */
function tryParseTasks(text: string): GeneratedTask[] | null {
  try {
    return parseTasks(text);
  } catch {
    return null;
  }
}

/** Flatten nested subTasks into top-level tasks (used when breakIntoSubTasks is false). */
function flatten(tasks: GeneratedTask[]): GeneratedTask[] {
  const out: GeneratedTask[] = [];
  for (const task of tasks) {
    const { subTasks, ...rest } = task;
    out.push({ ...rest });
    if (subTasks?.length) out.push(...flatten(subTasks));
  }
  return out;
}

@Injectable()
export class BaUserStoryAgent implements Agent {
  readonly kind = 'ba-user-story';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async run(ctx: unknown, onStep?: (line: string) => void): Promise<GeneratedTask[]> {
    const { projectId, prompt, breakIntoSubTasks, documents } = ctx as BaUserStoryCtx;

    const cfg = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!cfg) throw new NotFoundException('AI config not found. Save AI settings first.');

    const model = modelFor(cfg, this.config.getOrThrow<string>('ENCRYPTION_KEY'));
    const skillIndex = await buildSkillIndex(this.prisma, projectId);
    const skillTools = buildSkillTools(this.prisma, projectId);

    let systemPrompt = skillIndex
      ? `${SYSTEM_PROMPT}\n\nAvailable skills (call load_skill to read a body):\n${skillIndex}`
      : SYSTEM_PROMPT;

    // Always ground with GitNexus when a repo is indexed; fall through on failure.
    const repos = await this.prisma.repository.findMany({
      where: { projectId, cloneStatus: 'cloned', indexStatus: 'indexed' },
      select: { name: true },
    });
    let gitnexusTools: unknown[] = [];
    let closeGitnexus: (() => Promise<void>) | null = null;
    if (repos.length > 0) {
      try {
        const { tools, close } = await gitnexusMcpTools();
        gitnexusTools = tools;
        closeGitnexus = close;
        systemPrompt +=
          `\n\nGitNexus code-graph tools cover indexed repos: ` +
          `${repos.map((r) => r.name).join(', ')}. Pass the repo name as the \`repo\` argument.`;
      } catch {
        // gitnexus unavailable — proceed without code-graph tools.
      }
    }

    try {
      const agent = createDeepAgent({
        model,
        tools: [...skillTools, ...(gitnexusTools as any[])],
        systemPrompt,
      });
      const input = {
        messages: [
          {
            role: 'user',
            content: buildUserPrompt({
              prompt,
              projectContext: cfg.projectContext,
              breakIntoSubTasks,
              documents,
            }),
          },
        ],
      };

      // Latest assistant text, accumulated for salvage on limit/timeout. Never emitted.
      let lastText = '';
      let genAnnounced = false;
      try {
        const stream = await agent.streamEvents(input, {
          version: 'v2',
          recursionLimit: 120,
          signal: AbortSignal.timeout(5 * 60_000),
        });
        for await (const ev of stream) {
          if (ev.event === 'on_tool_start') {
            onStep?.(TOOL_LABELS[ev.name] ?? '⚙ Working…');
          } else if (ev.event === 'on_chat_model_start') {
            // New model turn — keep only the latest call's text for parse/salvage.
            lastText = '';
          } else if (ev.event === 'on_chat_model_stream') {
            if (!genAnnounced) {
              genAnnounced = true;
              onStep?.('✍️ Generating tasks…');
            }
            const chunk = ev.data?.chunk;
            const content = chunk?.content;
            if (typeof content === 'string') lastText += content;
            else if (Array.isArray(content))
              lastText += content.map((c: any) => (c.type === 'text' ? c.text : '')).join('');
          }
        }
        const tasks = parseTasks(lastText);
        return breakIntoSubTasks ? tasks : flatten(tasks);
      } catch (err: any) {
        const isLimit =
          err?.name === 'GraphRecursionError' ||
          err?.name === 'AbortError' ||
          /recursion/i.test(err?.message ?? '');
        if (isLimit) {
          const salvaged = tryParseTasks(lastText);
          if (salvaged) return breakIntoSubTasks ? salvaged : flatten(salvaged);
          throw new BadRequestException(
            'Task generation stopped: took too long or too many steps.',
          );
        }
        throw err;
      }
    } finally {
      if (closeGitnexus) await closeGitnexus();
    }
  }
}
