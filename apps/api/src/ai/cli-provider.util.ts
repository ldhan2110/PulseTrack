const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

// Maps adapterType to the CLI binary for custom providers
const ADAPTER_CLI: Record<string, string> = {
  openai: 'codex',
  anthropic: 'claude',
  gemini: 'gemini',
};

export function getCliCommand(provider: string, adapterType?: string | null): string {
  if (provider === 'custom') {
    return ADAPTER_CLI[adapterType ?? 'openai'] ?? 'codex';
  }
  return CLI_COMMANDS[provider] ?? provider;
}

export function buildCliArgs(
  provider: string,
  model: string,
  prompt: string,
  opts?: { dangerouslySkipPermissions?: boolean; maxTurns?: number; adapterType?: string | null },
): string[] {
  const effectiveProvider = provider === 'custom'
    ? (ADAPTER_CLI[opts?.adapterType ?? 'openai'] === 'claude' ? 'claude' : 'codex')
    : provider;

  switch (effectiveProvider) {
    case 'claude': {
      const args = ['-p', prompt, '--output-format', 'text', '--model', model];
      if (opts?.dangerouslySkipPermissions) args.unshift('--dangerously-skip-permissions');
      if (opts?.maxTurns) args.push('--max-turns', String(opts.maxTurns));
      return args;
    }
    case 'gemini':
      return ['-p', prompt, '--model', model];
    default:
      return ['-p', prompt, '--model', model];
  }
}

export function buildCliEnv(
  provider: string,
  apiKey: string,
  baseUrl?: string | null,
  adapterType?: string | null,
): Record<string, string> {
  const effective = provider === 'custom' ? (adapterType ?? 'openai') : provider;

  switch (effective) {
    case 'claude':
    case 'anthropic':
      return { CLAUDE_CODE_OAUTH_TOKEN: apiKey };
    case 'gemini':
      return { GEMINI_API_KEY: apiKey };
    case 'codex':
    case 'openai':
      return {
        OPENAI_API_KEY: apiKey,
        ...(baseUrl && { OPENAI_BASE_URL: baseUrl }),
      };
    default:
      return {};
  }
}
