import type { AiClient } from './interfaces/ai-client.interface';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';

export type AiProvider = 'claude' | 'gemini' | 'codex' | 'custom';

export function createAiClient(
  provider: AiProvider | string,
  apiKey: string,
  baseUrl?: string | null,
): AiClient {
  // Gateway mode: baseUrl provided → always OpenAI-compatible (9router, OpenRouter, etc.)
  if (baseUrl) {
    return new OpenAiAdapter(apiKey, baseUrl);
  }

  switch (provider) {
    case 'claude':
      return new AnthropicAdapter(apiKey);
    case 'codex':
      return new OpenAiAdapter(apiKey);
    case 'custom':
      return new OpenAiAdapter(apiKey);
    case 'gemini':
      // ponytail: add GoogleAdapter when needed
      throw new Error('Gemini requires baseUrl (use gateway) or wait for GoogleAdapter');
    default:
      return new OpenAiAdapter(apiKey);
  }
}
