import OpenAI from 'openai';
import type {
  AiClient,
  AiChatRequest,
  AiChatResponse,
  AiStreamEvent,
  AiMessage,
  AiToolDef,
  AiStopReason,
  AiContentBlock,
} from '../interfaces/ai-client.interface';

export class OpenAiAdapter implements AiClient {
  private readonly client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, ...(baseURL && { baseURL }) });
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: this.toOpenAiMessages(request.system, request.messages),
      ...(request.tools?.length && {
        tools: request.tools.map((t) => this.toOpenAiTool(t)),
      }),
      ...(request.maxTokens && { max_tokens: request.maxTokens }),
    });

    const choice = response.choices[0];
    return {
      stopReason: this.mapFinishReason(choice.finish_reason),
      content: this.parseChoiceContent(choice.message),
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }

  async *stream(request: AiChatRequest): AsyncIterable<AiStreamEvent> {
    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages: this.toOpenAiMessages(request.system, request.messages),
      ...(request.tools?.length && {
        tools: request.tools.map((t) => this.toOpenAiTool(t)),
      }),
      ...(request.maxTokens && { max_tokens: request.maxTokens }),
      stream: true,
    });

    const toolAccum = new Map<
      number,
      { id: string; name: string; args: string }
    >();
    let fullText = '';
    let finishReason: AiStopReason = 'end';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const reason = chunk.choices[0]?.finish_reason;

      if (delta?.content) {
        fullText += delta.content;
        yield { type: 'text_delta', text: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolAccum.get(tc.index);
          if (existing) {
            existing.args += tc.function?.arguments ?? '';
          } else {
            toolAccum.set(tc.index, {
              id: tc.id ?? '',
              name: tc.function?.name ?? '',
              args: tc.function?.arguments ?? '',
            });
          }
        }
      }

      if (reason) {
        finishReason = this.mapFinishReason(reason);
      }
    }

    const content: AiContentBlock[] = [];
    if (fullText) content.push({ type: 'text', text: fullText });

    for (const [, tool] of toolAccum) {
      const parsed = JSON.parse(tool.args) as Record<string, unknown>;
      content.push({ type: 'tool_use', id: tool.id, name: tool.name, input: parsed });
      yield { type: 'tool_call', id: tool.id, name: tool.name, input: parsed };
    }

    yield {
      type: 'done',
      response: {
        stopReason: finishReason,
        content,
        usage: { inputTokens: 0, outputTokens: 0 },
      },
    };
  }

  private toOpenAiMessages(
    system: string,
    messages: AiMessage[],
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
    ];

    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        const text = msg.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('');
        const toolCalls = msg.content
          .filter((b) => b.type === 'tool_use')
          .map((b) => ({
            id: b.id,
            type: 'function' as const,
            function: { name: b.name, arguments: JSON.stringify(b.input) },
          }));
        result.push({
          role: 'assistant',
          ...(text && { content: text }),
          ...(toolCalls.length && { tool_calls: toolCalls }),
        });
      } else if (msg.role === 'tool_result') {
        result.push({
          role: 'tool',
          tool_call_id: msg.toolCallId,
          content: msg.content,
        });
      }
    }

    return result;
  }

  private toOpenAiTool(tool: AiToolDef): OpenAI.Chat.Completions.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    };
  }

  private parseChoiceContent(
    message: OpenAI.Chat.Completions.ChatCompletionMessage,
  ): AiContentBlock[] {
    const blocks: AiContentBlock[] = [];
    if (message.content) {
      blocks.push({ type: 'text', text: message.content });
    }
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        if (tc.type !== 'function') continue;
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
        });
      }
    }
    return blocks;
  }

  private mapFinishReason(reason: string | null): AiStopReason {
    switch (reason) {
      case 'tool_calls':
        return 'tool_use';
      case 'length':
        return 'max_tokens';
      default:
        return 'end';
    }
  }
}
