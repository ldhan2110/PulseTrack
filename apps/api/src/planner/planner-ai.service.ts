import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';

interface PlannerAction {
  action: 'add_scope' | 'add_feature' | 'update_scope' | 'update_feature' | 'suggest';
  title?: string;
  description?: string;
  scopeTitle?: string;
  id?: string;
  type?: string;
  reason?: string;
}

interface ChatContext {
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
}

const PLANNER_SYSTEM_PROMPT = `You are an expert Business Analyst (BA) assistant embedded in a project management tool called PulseTrack. Your role is to help BAs gather, refine, and organize software requirements through collaborative conversation.

## Your Behavior

1. **Actively drive the conversation** — Don't just answer questions. Probe deeper, challenge assumptions, identify gaps.
2. **Ask probing questions** — "You mentioned X, but what about Y? Will there be Z?"
3. **Challenge assumptions** — "You said 'checkout' but haven't mentioned payment integration. Is that in scope?"
4. **Identify gaps** — "I notice no mention of notifications. Should users be notified about X?"
5. **Suggest common patterns** — "For e-commerce platforms, you typically need: wishlist, order history, returns. Include any?"
6. **Confirm understanding** — "Let me summarize what I understand about this scope before moving on..."
7. **Prioritize** — "Which of these is highest priority for MVP?"
8. **Build incrementally** — Add a few scopes/features at a time through conversation. Never dump everything at once.

## Requirements Elicitation Techniques
- 5 Whys for root cause
- MoSCoW prioritization (Must/Should/Could/Won't)
- User story mapping
- Domain-specific checklists (auth, roles, audit trail, GDPR for user systems)
- Conflict detection — flag contradictions

## Response Format

Your response has two parts. First, your natural conversational message. Then, if you've identified new scopes or features, append a structured actions block:

\`\`\`
[Your conversational response here]

---PLANNER_ACTIONS---
[
  {"action": "add_scope", "title": "Scope Name", "description": "Short description"},
  {"action": "add_feature", "scopeTitle": "Scope Name", "title": "Feature Name", "description": "Short description"},
  {"action": "update_scope", "id": "scope_id", "title": "New Title", "description": "New description"},
  {"action": "update_feature", "id": "feature_id", "title": "New Title", "description": "New description"},
  {"action": "suggest", "type": "generate_prd", "reason": "We have enough scopes to generate a PRD"}
]
\`\`\`

Rules for actions:
- Only include the ---PLANNER_ACTIONS--- block when you have actual scope/feature changes
- When adding a feature, use "scopeTitle" to reference an existing scope by title (or a new scope you're adding in the same batch)
- Keep titles concise (under 60 chars) and descriptions under 200 chars
- Use "suggest" action when you think the user should generate a PRD, export, or summarize

## Current State

You will be given the current scopes and features. Use this to avoid duplicates and to reference existing items for updates.`;

@Injectable()
export class PlannerAiService {
  private readonly logger = new Logger(PlannerAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  buildContext(
    currentScopes: Array<{ id: string; title: string; description: string | null; features: Array<{ id: string; title: string; description: string | null }> }>,
    chatHistory: Array<{ role: string; content: string }>,
    userMessage: string,
    attachmentTexts: string[],
  ): ChatContext {
    const scopeContext = currentScopes.length > 0
      ? `\n## Current Scopes & Features\n${currentScopes.map((s) =>
          `- **${s.title}** (id: ${s.id}): ${s.description ?? 'No description'}\n${s.features.map((f) =>
            `  - ${f.title} (id: ${f.id}): ${f.description ?? 'No description'}`).join('\n')}`
        ).join('\n')}`
      : '\n## Current Scopes & Features\nNone yet — this is the start of the planning session.';

    const attachmentContext = attachmentTexts.length > 0
      ? `\n\n## Attached Documents\n${attachmentTexts.map((t, i) => `### Attachment ${i + 1}\n${t}`).join('\n\n')}`
      : '';

    const systemPrompt = PLANNER_SYSTEM_PROMPT + scopeContext + attachmentContext;

    const messages = [
      ...chatHistory.slice(-20).map((m) => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    return { systemPrompt, messages };
  }

  parseActions(fullResponse: string): { chatContent: string; actions: PlannerAction[] } {
    const delimiter = '---PLANNER_ACTIONS---';
    const delimiterIndex = fullResponse.indexOf(delimiter);

    if (delimiterIndex === -1) {
      return { chatContent: fullResponse.trim(), actions: [] };
    }

    const chatContent = fullResponse.slice(0, delimiterIndex).trim();
    const actionsJson = fullResponse.slice(delimiterIndex + delimiter.length).trim();

    try {
      const actions = JSON.parse(actionsJson) as PlannerAction[];
      return { chatContent, actions };
    } catch (e) {
      this.logger.warn('Failed to parse planner actions JSON', actionsJson);
      return { chatContent, actions: [] };
    }
  }

  async getDecryptedApiKey(projectId: string): Promise<{ provider: string; model: string; apiKey: string } | null> {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) return null;

    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);
    return { provider: aiConfig.provider, model: aiConfig.model, apiKey };
  }

  async *streamChatResponse(
    provider: string,
    model: string,
    apiKey: string,
    context: ChatContext,
  ): AsyncGenerator<string> {
    if (provider === 'anthropic') {
      yield* this.streamAnthropic(model, apiKey, context);
    } else {
      yield* this.streamOpenAI(provider, model, apiKey, context);
    }
  }

  private async *streamAnthropic(
    model: string,
    apiKey: string,
    context: ChatContext,
  ): AsyncGenerator<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: context.systemPrompt,
        messages: context.messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${err}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text;
          }
        } catch {
          // skip non-JSON lines
        }
      }
    }
  }

  private async *streamOpenAI(
    provider: string,
    model: string,
    apiKey: string,
    context: ChatContext,
  ): AsyncGenerator<string> {
    const baseUrl = provider === 'openai'
      ? 'https://api.openai.com/v1'
      : provider === 'groq'
        ? 'https://api.groq.com/openai/v1'
        : 'https://api.openai.com/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: 'system', content: context.systemPrompt },
          ...context.messages,
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${err}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip non-JSON lines
        }
      }
    }
  }
}
