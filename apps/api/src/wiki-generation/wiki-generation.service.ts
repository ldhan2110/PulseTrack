import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAbsolute, resolve, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';

const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

@Injectable()
export class WikiGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  getWikiPath(projectId: string): string {
    const configDir = this.config.get<string>('WIKI_DIR');
    if (!configDir) {
      return join(process.cwd(), 'wikis', projectId);
    }
    const baseDir = isAbsolute(configDir) ? configDir : resolve(process.cwd(), configDir);
    return join(baseDir, projectId);
  }

  async getProjectConfig(projectId: string) {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) throw new BadRequestException('AI configuration not found. Save AI settings first.');

    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException('Repository must be cloned before generating wiki.');
    }

    const wikiConfig = await this.prisma.wikiConfig.findUnique({ where: { projectId } });
    if (!wikiConfig) throw new BadRequestException('Wiki configuration not found. Save wiki settings first.');

    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      projectContext: aiConfig.projectContext,
      workspacePath: repoConfig.workspacePath!,
      cli: CLI_COMMANDS[aiConfig.provider] ?? aiConfig.provider,
      wikiPath: this.getWikiPath(projectId),
      sections: wikiConfig.sections,
    };
  }

  buildLlmWikiIngestPrompt(wikiPath: string, sections: string[], projectContext: string | null): string {
    const parts = [
      `Use /llm-wiki ingest to generate wiki documentation.`,
      `Output directory: ${wikiPath}`,
      `Sections to generate: ${sections.join(', ')}`,
      ``,
      `The wiki should include structured markdown files with YAML frontmatter (title, section, generatedAt, relatedFiles, tags).`,
      `Organize output into subdirectories per section (e.g., architecture/, modules/, features/).`,
    ];
    if (projectContext) {
      parts.push(`\n## Project Context\n${projectContext}`);
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

  parseGeneratedFiles(raw: string): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];
    const filePattern = /<!--\s*file:\s*([\w\-\/\.]+)\s*-->\s*(?:```(?:markdown|md)?\s*\n?([\s\S]*?)```|([\s\S]*?))(?=<!--\s*file:|$)/g;
    let match: RegExpExecArray | null;
    while ((match = filePattern.exec(raw)) !== null) {
      const filePath = match[1].trim();
      const content = (match[2] ?? match[3] ?? '').trim();
      if (filePath && content) {
        files.push({ path: filePath, content });
      }
    }
    return files;
  }

  async updateLastGenerated(projectId: string) {
    await this.prisma.wikiConfig.update({
      where: { projectId },
      data: { lastGeneratedAt: new Date() },
    });
  }
}
