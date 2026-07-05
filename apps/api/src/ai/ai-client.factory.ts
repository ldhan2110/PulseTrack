import type { AiClient } from './interfaces/ai-client.interface';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';

export type AiProvider = 'claude' | 'gemini' | 'codex' | 'custom';

export function createAiClient(
  provider: AiProvider | string,
  apiKey: string,
  baseUrl?: string | null,
  adapterType?: string | null,
): AiClient {
  if (provider === 'custom') {
    const adapter = adapterType ?? 'openai';
    switch (adapter) {
      case 'anthropic':
        return new AnthropicAdapter(apiKey, baseUrl ?? undefined);
      case 'gemini':
        throw new Error('Gemini SDK adapter not available — use gateway with openai adapter type');
      default:
        return new OpenAiAdapter(apiKey, baseUrl ?? undefined);
    }
  }

  // Non-custom: baseUrl provided → OpenAI-compatible gateway
  if (baseUrl) {
    return new OpenAiAdapter(apiKey, baseUrl);
  }

  switch (provider) {
    case 'claude':
      return new AnthropicAdapter(apiKey);
    case 'gemini':
      // ponytail: add GoogleAdapter when needed
      throw new Error('Gemini requires baseUrl (use gateway) or wait for GoogleAdapter');
    default:
      return new OpenAiAdapter(apiKey);
  }
}
