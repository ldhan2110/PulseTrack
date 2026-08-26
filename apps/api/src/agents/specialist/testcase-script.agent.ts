import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createAgent,
  toolErrorMiddleware,
  contextEditingMiddleware,
  ClearToolUsesEdit,
} from 'langchain';
import { PrismaService } from '../../prisma/prisma.service';
import type { Agent } from '../agent.interface';
import { modelFor } from '../ai-client';
import { playwrightMcpTools } from '../mcp/playwright-mcp.client';
import { SYSTEM_PROMPT, buildUserPrompt, lintScript } from '../prompts/testcase-script.prompt';

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

/**
 * Turn a playwright-mcp tool call into a human-readable progress line so the UI
 * shows WHAT the agent is doing (which element/URL), not a generic "inspecting".
 * playwright-mcp puts a plain-language `element` description in click/type args.
 */
function describeToolCall(name: string, input: any): string {
  const el = input?.element ? `"${input.element}"` : '';
  switch (name) {
    case 'browser_navigate':
      return `🌐 Opening ${input?.url ?? 'page'}`;
    case 'browser_snapshot':
      return '📸 Reading page';
    case 'browser_click':
      return `🖱️ Clicking ${el}`.trim();
    case 'browser_type': {
      const val = input?.text != null ? ` = "${String(input.text)}"` : '';
      return `⌨️ Typing into ${el}${val}`.trim();
    }
    case 'browser_select_option': {
      const vals = Array.isArray(input?.values) ? input.values.join(', ') : input?.values;
      const val = vals != null ? ` = "${vals}"` : '';
      return `🔽 Selecting in ${el}${val}`.trim();
    }
    case 'browser_press_key':
      return `⌨️ Pressing ${input?.key ?? 'key'}`;
    case 'browser_wait_for':
      return '⏳ Waiting for page';
    default:
      return `🔧 ${name.replace(/^browser_/, '')}`;
  }
}

/** Extract text from a tool_end output (string, ToolMessage, or content array). */
function toolOutputText(output: any): string {
  const c = output?.content ?? output;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((b: any) => (typeof b === 'string' ? b : b?.text ?? '')).join(' ');
  return '';
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
      const agent = createAgent({
        model,
        tools,
        systemPrompt: SYSTEM_PROMPT,
        middleware: [
          // playwright-mcp browser_snapshot returns the FULL page tree (~140KB on
          // heavy enterprise UIs). Left in history, every prior snapshot is re-sent
          // each turn → context bloat → misclicks/retries → recursion overflow. Only
          // the latest snapshot matters, so clear stale tool outputs once history
          // grows, keeping the 3 most recent.
          contextEditingMiddleware({
            edits: [new ClearToolUsesEdit({ trigger: { tokens: 60_000 }, keep: { messages: 3 } })],
          }),
          // Feed tool failures back to the model (as an error ToolMessage) instead
          // of letting them throw out of the loop, so it can re-snapshot and retry.
          toolErrorMiddleware({
            onError: (err, req) =>
              `Tool ${req.toolCall.name} failed: ${String(err)}. ` +
              `Call browser_snapshot to get a fresh accessibility tree, locate the ` +
              `target element, then retry with its current ref.`,
          }),
        ],
      });
      // ponytail: scale limit to step count; ~6 super-steps/step + slack, cap 250.
      // Lighter createAgent (no deepagents middleware) means the same budget buys more real actions.
      const stepCount = testCase.steps?.length ?? 0;
      const recursionLimit = Math.min(250, 40 + stepCount * 6);

      // Consume one agent stream to completion, returning the emitted script text.
      const messages: { role: string; content: string }[] = [
        { role: 'user', content: buildUserPrompt(testCase) },
      ];
      const runOnce = async (): Promise<string> => {
        let text = '';
        let writeAnnounced = false;
        const stream = await agent.streamEvents({ messages }, { version: 'v2', recursionLimit });
        for await (const ev of stream) {
          if (ev.event === 'on_tool_start') {
            onStep?.(describeToolCall(ev.name, ev.data?.input));
          } else if (ev.event === 'on_tool_end') {
            // toolErrorMiddleware folds failures into the tool output as an error
            // ToolMessage ("Tool X failed: …") — surface it so a retry loop is visible.
            if (/^Tool \S+ failed:/.test(toolOutputText(ev.data?.output)))
              onStep?.(`⚠️ ${ev.name.replace(/^browser_/, '')} failed, retrying…`);
          } else if (ev.event === 'on_tool_error') {
            onStep?.(`⚠️ ${ev.name.replace(/^browser_/, '')} error: ${ev.data?.error ?? 'unknown'}`);
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
      };

      let script = await runOnce();
      // Lint for flakiness anti-patterns; on a hit, re-prompt once with the
      // fixes. One retry only — enough to catch strays, no runaway loop.
      const feedback = lintScript(script);
      if (feedback) {
        onStep?.('🔁 Fixing flaky patterns…');
        messages.push({ role: 'assistant', content: script });
        messages.push({ role: 'user', content: feedback });
        script = await runOnce();
      }
      return script;
    } finally {
      await close();
    }
  }
}
