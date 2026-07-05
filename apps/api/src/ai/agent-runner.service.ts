import { Injectable } from '@nestjs/common';
import type {
  AiClient,
  AiChatResponse,
  AiMessage,
  AiAssistantMessage,
  AiStreamEvent,
  AiUsage,
} from './interfaces/ai-client.interface';
import type { ToolRegistry } from './tool-registry.service';

export interface AgentRunOpts {
  client: AiClient;
  model: string;
  system: string;
  prompt: string;
  tools?: ToolRegistry;
  /** Default: 1 (single-shot) if no tools, 50 if tools provided */
  maxTurns?: number;
  maxTokens?: number;
  onTextChunk?: (text: string) => void;
  onToolCall?: (name: string, input: Record<string, unknown>, result: string) => void;
  signal?: AbortSignal;
}

export interface AgentRunResult {
  text: string;
  messages: AiMessage[];
  usage: AiUsage;
  turns: number;
}

@Injectable()
export class AgentRunner {
  async run(opts: AgentRunOpts): Promise<AgentRunResult> {
    const messages: AiMessage[] = [{ role: 'user', content: opts.prompt }];
    const toolDefs = opts.tools?.getToolDefs();
    const hasTools = toolDefs && toolDefs.length > 0;
    const maxTurns = opts.maxTurns ?? (hasTools ? 50 : 1);
    const totalUsage: AiUsage = { inputTokens: 0, outputTokens: 0 };

    for (let turn = 0; turn < maxTurns; turn++) {
      if (opts.signal?.aborted) throw new Error('Agent run aborted');

      const response = await opts.client.chat({
        model: opts.model,
        system: opts.system,
        messages,
        tools: hasTools ? toolDefs : undefined,
        maxTokens: opts.maxTokens,
      });

      totalUsage.inputTokens += response.usage.inputTokens;
      totalUsage.outputTokens += response.usage.outputTokens;

      for (const block of response.content) {
        if (block.type === 'text' && opts.onTextChunk) {
          opts.onTextChunk(block.text);
        }
      }

      messages.push({ role: 'assistant', content: response.content });

      if (response.stopReason !== 'tool_use' || !opts.tools) break;

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        const result = await opts.tools.execute(block.name, block.input);
        opts.onToolCall?.(block.name, block.input, result);

        messages.push({
          role: 'tool_result',
          toolCallId: block.id,
          content: result,
        });
      }
    }

    const lastAssistant = [...messages].reverse().find((m): m is AiAssistantMessage => m.role === 'assistant');
    const text = lastAssistant
      ? lastAssistant.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('')
      : '';

    return {
      text,
      messages,
      usage: totalUsage,
      turns: messages.filter((m) => m.role === 'assistant').length,
    };
  }

  async *stream(opts: AgentRunOpts): AsyncGenerator<AiStreamEvent> {
    const messages: AiMessage[] = [{ role: 'user', content: opts.prompt }];
    const toolDefs = opts.tools?.getToolDefs();
    const hasTools = toolDefs && toolDefs.length > 0;
    const maxTurns = opts.maxTurns ?? (hasTools ? 50 : 1);

    for (let turn = 0; turn < maxTurns; turn++) {
      if (opts.signal?.aborted) return;

      let response: AiChatResponse | undefined;

      for await (const event of opts.client.stream({
        model: opts.model,
        system: opts.system,
        messages,
        tools: hasTools ? toolDefs : undefined,
        maxTokens: opts.maxTokens,
      })) {
        yield event;
        if (event.type === 'done') response = event.response;
      }

      if (!response) break;

      messages.push({ role: 'assistant', content: response.content });

      if (response.stopReason !== 'tool_use' || !opts.tools) break;

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const result = await opts.tools.execute(block.name, block.input);
        opts.onToolCall?.(block.name, block.input, result);
        messages.push({ role: 'tool_result', toolCallId: block.id, content: result });
      }
    }
  }
}
