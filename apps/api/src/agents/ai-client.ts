import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AiConfig } from '@prisma/client';
import { decrypt } from '../common/encryption.util';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * Resolve a LangChain chat model from a project's AiConfig.
 * `apiKey` is the AES-256-GCM encrypted value stored in the DB.
 */
export function modelFor(cfg: AiConfig, encryptionKey: string): BaseChatModel {
  const provider = cfg.provider === 'custom' ? (cfg.adapterType ?? 'openai') : cfg.provider;
  const apiKey = decrypt(cfg.apiKey, encryptionKey);

  switch (provider) {
    case 'anthropic':
    case 'claude':
      return new ChatAnthropic({
        model: cfg.model,
        apiKey,
        ...(cfg.baseUrl ? { anthropicApiUrl: cfg.baseUrl } : {}),
      });
    case 'gemini':
      return new ChatGoogleGenerativeAI({ model: cfg.model, apiKey });
    case 'openai':
    case 'codex':
    default:
      return new ChatOpenAI({
        model: cfg.model,
        apiKey,
        configuration: { baseURL: cfg.baseUrl ?? DEFAULT_BASE_URL },
      });
  }
}
