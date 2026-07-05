// ─── Messages ────────────────────────────────────────────

export interface AiTextBlock {
  type: 'text';
  text: string;
}

export interface AiToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type AiContentBlock = AiTextBlock | AiToolUseBlock;

export interface AiToolResultMessage {
  role: 'tool_result';
  toolCallId: string;
  content: string;
}

export interface AiUserMessage {
  role: 'user';
  content: string;
}

export interface AiAssistantMessage {
  role: 'assistant';
  content: AiContentBlock[];
}

export type AiMessage = AiUserMessage | AiAssistantMessage | AiToolResultMessage;

// ─── Tools ───────────────────────────────────────────────

export interface AiToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ─── Request / Response ──────────────────────────────────

export type AiStopReason = 'end' | 'tool_use' | 'max_tokens';

export interface AiChatRequest {
  model: string;
  system: string;
  messages: AiMessage[];
  tools?: AiToolDef[];
  maxTokens?: number;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiChatResponse {
  stopReason: AiStopReason;
  content: AiContentBlock[];
  usage: AiUsage;
}

// ─── Streaming ───────────────────────────────────────────

export interface AiTextDeltaEvent {
  type: 'text_delta';
  text: string;
}

export interface AiToolCallEvent {
  type: 'tool_call';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AiDoneEvent {
  type: 'done';
  response: AiChatResponse;
}

export type AiStreamEvent = AiTextDeltaEvent | AiToolCallEvent | AiDoneEvent;

// ─── Client Interface ────────────────────────────────────

export interface AiClient {
  chat(request: AiChatRequest): Promise<AiChatResponse>;
  stream(request: AiChatRequest): AsyncIterable<AiStreamEvent>;
}
