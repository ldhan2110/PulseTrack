import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, execSync } from 'child_process';
import axios from 'axios';
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

const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

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

  async getProjectAiConfig(projectId: string): Promise<{
    provider: string;
    model: string;
    apiKey: string;
    workspacePath: string | null;
    cli: string;
  } | null> {
    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');

    // Check dedicated planner config first (OpenRouter)
    const plannerConfig = await this.prisma.plannerAiConfig.findUnique({ where: { projectId } });
    if (plannerConfig) {
      const apiKey = decrypt(plannerConfig.apiKey, encryptionKey);
      const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
      const workspacePath = repoConfig?.cloneStatus === 'cloned' ? repoConfig.workspacePath : null;
      return { provider: plannerConfig.provider, model: plannerConfig.model, apiKey, workspacePath, cli: '' };
    }

    // Fall back to shared AI config
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) return null;

    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);
    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    const workspacePath = repoConfig?.cloneStatus === 'cloned' ? repoConfig.workspacePath : null;

    const cliName = CLI_COMMANDS[aiConfig.provider] ?? aiConfig.provider;
    const cli = this.resolveCliPath(cliName);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      workspacePath,
      cli,
    };
  }

  /**
   * Resolve the full path to a CLI binary using the system shell,
   * so spawn() works even when the binary isn't in the Node process PATH.
   */
  private resolveCliPath(name: string): string {
    try {
      return execSync(`which ${name}`, { encoding: 'utf-8' }).trim();
    } catch {
      this.logger.warn(`Could not resolve CLI path for "${name}", using name directly`);
      return name;
    }
  }

  /**
   * Build the full prompt string from context, flattening chat history
   * into the prompt since the CLI is stateless (no multi-turn).
   */
  buildCliPrompt(context: ChatContext): string {
    const parts: string[] = [context.systemPrompt];

    if (context.messages.length > 1) {
      parts.push('\n## Conversation History');
      // All messages except the last one (which is the current user message)
      for (const msg of context.messages.slice(0, -1)) {
        const label = msg.role === 'user' ? 'User' : 'Assistant';
        parts.push(`\n**${label}:** ${msg.content}`);
      }
    }

    const lastMessage = context.messages[context.messages.length - 1];
    if (lastMessage) {
      parts.push(`\n## Current User Message\n${lastMessage.content}`);
    }

    return parts.join('\n');
  }

  buildCliArgs(provider: string, model: string, prompt: string): string[] {
    switch (provider) {
      case 'claude':
        return ['--dangerously-skip-permissions', '-p', prompt, '--output-format', 'text', '--model', model];
      case 'gemini':
        return ['-p', prompt, '--model', model];
      case 'codex':
        return ['-p', prompt, '--model', model];
      default:
        return ['-p', prompt];
    }
  }

  buildCliEnv(provider: string, apiKey: string): Record<string, string> {
    switch (provider) {
      case 'claude':
        return { CLAUDE_CODE_OAUTH_TOKEN: apiKey };
      case 'gemini':
        return { GEMINI_API_KEY: apiKey };
      case 'codex':
        return { OPENAI_API_KEY: apiKey };
      default:
        return {};
    }
  }

  /**
   * Stream chat response — uses HTTP streaming for OpenRouter,
   * CLI spawning for other providers.
   */
  async *streamChatResponse(
    config: { provider: string; model: string; apiKey: string; workspacePath: string | null; cli: string },
    context: ChatContext,
  ): AsyncGenerator<string> {
    if (config.provider === 'openrouter') {
      yield* this.streamOpenRouterResponse(config, context);
      return;
    }

    const prompt = this.buildCliPrompt(context);
    const args = this.buildCliArgs(config.provider, config.model, prompt);
    const env = this.buildCliEnv(config.provider, config.apiKey);
    const cwd = config.workspacePath ?? process.cwd();

    this.logger.log(`Spawning CLI: ${config.cli} (provider=${config.provider}, model=${config.model}, cwd=${cwd})`);

    const { readable, promise } = this.spawnCliStream(config.cli, args, {
      cwd,
      timeout: 300_000,
      env: { ...process.env, ...env },
    });

    for await (const chunk of readable) {
      yield chunk;
    }

    await promise;
  }

  /**
   * Stream a chat completion from OpenRouter using their OpenAI-compatible API.
   */
  private async *streamOpenRouterResponse(
    config: { model: string; apiKey: string },
    context: ChatContext,
  ): AsyncGenerator<string> {
    this.logger.log(`OpenRouter streaming: model=${config.model}`);

    const messages = [
      { role: 'system' as const, content: context.systemPrompt },
      ...context.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: config.model,
        messages,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pulsetrack.app',
          'X-Title': 'PulseTrack Planner',
        },
        responseType: 'stream',
        timeout: 300_000,
      },
    );

    const stream = response.data as NodeJS.ReadableStream;
    let buffer = '';

    for await (const raw of stream) {
      buffer += raw.toString();
      const lines = buffer.split('\n');
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const payload = trimmed.slice(6);
        if (payload === '[DONE]') return;

        try {
          const parsed = JSON.parse(payload);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Skip malformed SSE chunks
        }
      }
    }
  }

  /**
   * Spawn a CLI process and return an async iterable of stdout chunks
   * plus a promise that resolves/rejects when the process exits.
   */
  private spawnCliStream(
    command: string,
    args: string[],
    opts: { cwd: string; timeout: number; env?: Record<string, string | undefined> },
  ): { readable: AsyncIterable<string>; promise: Promise<void> } {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
    }, opts.timeout);

    // Collect stderr for error reporting
    const stderrChunks: string[] = [];
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrChunks.push(text);
      for (const line of text.split('\n').filter(Boolean)) {
        this.logger.warn(`[planner-cli] ${line}`);
      }
    });

    // Create an async iterable from stdout
    const stdoutIterator = this.createAsyncIterableFromStream(child.stdout);

    // Promise that resolves when process exits successfully
    const promise = new Promise<void>((resolve, reject) => {
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (killed) {
          reject(new Error(`CLI timed out after ${opts.timeout}ms`));
          return;
        }
        if (code === 0 || code === null) {
          resolve();
        } else {
          const stderr = stderrChunks.join('').slice(0, 500);
          reject(new Error(`CLI exited with code ${code}${stderr ? `: ${stderr}` : ''}`));
        }
      });
    });

    return { readable: stdoutIterator, promise };
  }

  /**
   * Convert a Node readable stream into an async iterable of string chunks.
   */
  private async *createAsyncIterableFromStream(
    stream: NodeJS.ReadableStream,
  ): AsyncGenerator<string> {
    const chunks: string[] = [];
    let resolve: (() => void) | null = null;
    let done = false;

    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk.toString());
      if (resolve) {
        resolve();
        resolve = null;
      }
    });

    stream.on('end', () => {
      done = true;
      if (resolve) {
        resolve();
        resolve = null;
      }
    });

    stream.on('error', () => {
      done = true;
      if (resolve) {
        resolve();
        resolve = null;
      }
    });

    while (true) {
      if (chunks.length > 0) {
        yield chunks.shift()!;
      } else if (done) {
        break;
      } else {
        await new Promise<void>((r) => { resolve = r; });
      }
    }
  }
}
