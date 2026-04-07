import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';
import { AiConfigService } from './ai-config.service';

const execFileAsync = promisify(execFile);

const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

@Injectable()
export class AiContextGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly aiConfigService: AiConfigService,
  ) {}

  async generate(projectId: string) {
    const repoConfig = await this.prisma.repositoryConfig.findUnique({
      where: { projectId },
    });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException('Repository must be cloned before generating context');
    }

    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { projectId },
    });
    if (!aiConfig) {
      throw new BadRequestException('Save AI configuration first');
    }

    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);
    const cli = CLI_COMMANDS[aiConfig.provider] ?? aiConfig.provider;

    const prompt = `
      Scan this codebase and build a concise but structured understanding of the system. It should as short as possible while covering the following aspects:
      Focus on:
      - System purpose: what problem it solves and for whom
      - Core business capabilities (key features and user-facing behavior)

      Avoid:
      - Listing technologies or frameworks unless essential
      - Describing folder structure or low-level implementation
      - Generic or vague statements

      Write the summary so it can later be used to:
      - Generate product backlogs and user stories
      - Analyze feature gaps or inconsistencies
      - Detect and explain bugs or unexpected behaviors
      - Propose fixes aligned with intended system behavior
  `;

    const args = this.buildCliArgs(aiConfig.provider, aiConfig.model, prompt);
    const env = this.buildCliEnv(aiConfig.provider, apiKey);

    const { stdout } = await execFileAsync(cli, args, {
      cwd: repoConfig.workspacePath!,
      timeout: 120_000,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, ...env },
    });

    // Truncate to 10000 chars at last complete sentence
    let context = stdout.trim();
    const updated = await this.aiConfigService.updateContext(projectId, context);
    return { projectContext: updated.projectContext };
  }

  private buildCliArgs(provider: string, model: string, prompt: string): string[] {
    switch (provider) {
      case 'claude':
        return ['-p', prompt, '--output-format', 'text', '--model', model];
      case 'gemini':
        return ['-p', prompt, '--model', model];
      case 'codex':
        return ['-p', prompt, '--model', model];
      default:
        return ['-p', prompt];
    }
  }

  private buildCliEnv(provider: string, apiKey: string): Record<string, string> {
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
}
