import Anthropic from '@anthropic-ai/sdk';
import type {
  AiClient,
  AiChatRequest,
  AiChatResponse,
  AiStreamEvent,
  AiMessage,
  AiToolDef,
  AiStopReason,
  AiContentBlock,
  AiAssistantMessage,
} from '../interfaces/ai-client.interface';

export class AnthropicAdapter implements AiClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const response = await this.client.messages.create({
      model: request.model,
      system: request.system,
      messages: this.toAnthropicMessages(request.messages),
      max_tokens: request.maxTokens ?? 4096,
      ...(request.tools?.length && {
        tools: request.tools.map((t) => this.toAnthropicTool(t)),
      }),
    });

    return {
      stopReason: this.mapStopReason(response.stop_reason),
      content: response.content
        .filter((block) => block.type === 'text' || block.type === 'tool_use')
        .map((block): AiContentBlock => {
          if (block.type === 'text') {
            return { type: 'text', text: block.text };
          }
          return {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          };
        }),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async *stream(request: AiChatRequest): AsyncIterable<AiStreamEvent> {
    const stream = this.client.messages.stream({
      model: request.model,
      system: request.system,
      messages: this.toAnthropicMessages(request.messages),
      max_tokens: request.maxTokens ?? 4096,
      ...(request.tools?.length && {
        tools: request.tools.map((t) => this.toAnthropicTool(t)),
      }),
    });

    const toolInputFragments = new Map<number, string>();
    const toolBlocks = new Map<number, { id: string; name: string }>();

    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        toolBlocks.set(event.index, {
          id: event.content_block.id,
          name: event.content_block.name,
        });
        toolInputFragments.set(event.index, '');
      }

      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text_delta', text: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          const prev = toolInputFragments.get(event.index) ?? '';
          toolInputFragments.set(event.index, prev + event.delta.partial_json);
        }
      }

      if (event.type === 'content_block_stop') {
        const block = toolBlocks.get(event.index);
        if (block) {
          const rawInput = toolInputFragments.get(event.index) ?? '{}';
          yield {
            type: 'tool_call',
            id: block.id,
            name: block.name,
            input: JSON.parse(rawInput),
          };
          toolBlocks.delete(event.index);
          toolInputFragments.delete(event.index);
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      type: 'done',
      response: {
        stopReason: this.mapStopReason(finalMessage.stop_reason),
        content: finalMessage.content
          .filter((block) => block.type === 'text' || block.type === 'tool_use')
          .map((block): AiContentBlock => {
            if (block.type === 'text') {
              return { type: 'text', text: block.text };
            }
            return {
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input as Record<string, unknown>,
            };
          }),
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        },
      },
    };
  }

  private toAnthropicMessages(messages: AiMessage[]): Anthropic.MessageParam[] {
    return messages.map((msg): Anthropic.MessageParam => {
      if (msg.role === 'user') {
        return { role: 'user', content: msg.content };
      }
      if (msg.role === 'assistant') {
        const assistant = msg as AiAssistantMessage;
        return {
          role: 'assistant',
          content: assistant.content.map((block) => {
            if (block.type === 'text') {
              return { type: 'text' as const, text: block.text };
            }
            return {
              type: 'tool_use' as const,
              id: block.id,
              name: block.name,
              input: block.input,
            };
          }),
        };
      }
      // tool_result
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result' as const,
            tool_use_id: msg.toolCallId,
            content: msg.content,
          },
        ],
      };
    });
  }

  private toAnthropicTool(tool: AiToolDef): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
    };
  }

  private mapStopReason(reason: string | null): AiStopReason {
    if (reason === 'tool_use') return 'tool_use';
    if (reason === 'max_tokens') return 'max_tokens';
    return 'end';
  }
}
