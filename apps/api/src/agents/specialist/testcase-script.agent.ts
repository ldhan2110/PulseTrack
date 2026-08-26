import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDeepAgent } from 'deepagents';
import { toolErrorMiddleware } from 'langchain';
import { PrismaService } from '../../prisma/prisma.service';
import type { Agent } from '../agent.interface';
import { modelFor } from '../ai-client';
import { playwrightMcpTools } from '../mcp/playwright-mcp.client';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts/testcase-script.prompt';

export interface TestcaseScriptCtx {
  testCaseId: string;
}

/**
 * Extract the runnable script body. Grabs the first fenced code block even when
 * the model wraps it in prose (e.g. a "verified live" preamble); falls back to
 * the trimmed text when the model obeys and emits no fence.
 */
function stripFences(text: string): string {
  const t = text.trim();
  const fenced = t.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  return (fenced ? fenced[1] : t).trim();
}

@Injectable()
export class TestcaseScriptAgent implements Agent {
  readonly kind = 'testcase-script';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async run(ctx: unknown, onStep?: (line: string) => void): Promise<string> {
    const { testCaseId } = ctx as TestcaseScriptCtx;

    const testCase = await this.prisma.testCase.findUnique({
      where: { id: testCaseId },
      include: { steps: true },
    });
    if (!testCase) throw new NotFoundException('Test case not found');

    const cfg = await this.prisma.aiConfig.findUnique({ where: { projectId: testCase.projectId } });
    if (!cfg) throw new BadRequestException('Configure AI settings first.');

    const model = modelFor(cfg, this.config.getOrThrow<string>('ENCRYPTION_KEY'));
    const mcpUrl = this.config.get<string>('PLAYWRIGHT_MCP_URL') ?? 'http://localhost:8931/mcp';
    const { tools, close } = await playwrightMcpTools(mcpUrl);

    try {
      const agent = createDeepAgent({
        model,
        tools,
        systemPrompt: SYSTEM_PROMPT,
        // Feed tool failures back to the model (as an error ToolMessage) instead
        // of letting them throw out of the loop, so it can re-snapshot and retry.
        middleware: [
          toolErrorMiddleware({
            onError: (err, req) =>
              `Tool ${req.toolCall.name} failed: ${String(err)}. ` +
              `Call browser_snapshot to get a fresh accessibility tree, locate the ` +
              `target element, then retry with its current ref.`,
          }),
        ],
      });
      let text = '';
      let writeAnnounced = false;
      const stream = await agent.streamEvents(
        { messages: [{ role: 'user', content: buildUserPrompt(testCase) }] },
        // ponytail: recursionLimit=60 ≈ old 30-step cap; raise if flows truncate.
        { version: 'v2', recursionLimit: 60 },
      );
      for await (const ev of stream) {
        if (ev.event === 'on_tool_start') {
          onStep?.('🌐 Inspecting page…');
        } else if (ev.event === 'on_chat_model_start') {
          text = '';
        } else if (ev.event === 'on_chat_model_stream') {
          if (!writeAnnounced) {
            writeAnnounced = true;
            onStep?.('✍️ Writing script…');
          }
          const content = ev.data?.chunk?.content;
          if (typeof content === 'string') text += content;
          else if (Array.isArray(content))
            text += content.map((c: any) => (c.type === 'text' ? c.text : '')).join('');
        }
      }
      return stripFences(text);
    } finally {
      await close();
    }
  }
}
