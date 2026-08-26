import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, maskToken } from '../common/encryption.util';
import { modelFor } from '../agents/ai-client';
import { buildRepoFingerprint } from './repo-fingerprint.util';
import { UpsertAiConfigDto } from './dto/upsert-ai-config.dto';

const CONTEXT_MAX_LENGTH = 10000;

@Injectable()
export class AiConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  async findByProjectId(projectId: string) {
    const config = await this.prisma.aiConfig.findUnique({
      where: { projectId },
    });
    if (!config) return null;
    return { ...config, apiKey: maskToken(config.apiKey) };
  }

  async upsert(projectId: string, dto: UpsertAiConfigDto) {
    const encryptedKey = encrypt(dto.apiKey, this.encryptionKey);
    const isCustom = dto.provider === 'custom';
    const baseUrl = isCustom ? (dto.baseUrl ?? null) : null;
    const adapterType = isCustom ? (dto.adapterType ?? 'openai') : null;

    const config = await this.prisma.aiConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        provider: dto.provider,
        model: dto.model,
        apiKey: encryptedKey,
        baseUrl,
        adapterType,
        projectContext: dto.projectContext ?? null,
      },
      update: {
        provider: dto.provider,
        model: dto.model,
        apiKey: encryptedKey,
        baseUrl,
        adapterType,
        ...(dto.projectContext !== undefined && { projectContext: dto.projectContext }),
      },
    });

    return { ...config, apiKey: maskToken(dto.apiKey) };
  }

  async updateContext(projectId: string, projectContext: string) {
    const existing = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!existing) throw new NotFoundException('AI config not found. Save AI settings first.');

    const updated = await this.prisma.aiConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        provider: existing.provider,
        model: existing.model,
        apiKey: existing.apiKey,
        projectContext,
      },
      update: { projectContext },
    });

    return { ...updated, apiKey: maskToken(updated.apiKey) };
  }

  async generateContext(projectId: string): Promise<{ projectContext: string }> {
    const config = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!config) throw new NotFoundException('AI config not found. Save AI settings first.');

    const repos = await this.prisma.repository.findMany({
      where: { projectId, cloneStatus: 'cloned' },
    });
    if (repos.length === 0) throw new BadRequestException('Clone a repository first');

    const fingerprints = (
      await Promise.all(repos.map((r) => buildRepoFingerprint(r.workspacePath ?? '', r.name)))
    ).filter((f): f is string => f !== null);
    if (fingerprints.length === 0) throw new BadRequestException('Clone a repository first');

    const prompt = [
      'You are summarizing a software project for use as reusable AI context.',
      'This context will feed downstream tasks: bug fixing, test-case generation, and',
      'answering business/domain questions. Optimize for those uses — be concise and',
      'high-signal, skip filler.',
      '',
      'Below are one or more repositories that make up the project, each with its',
      'top-level layout, file-extension histogram, manifest, and README.',
      '',
      'Write a concise project context (max 10000 characters) in plain prose covering:',
      '- Business/domain: what the product does, who uses it, core domain concepts and workflows.',
      '- Per repo: its purpose, role, and tech stack (languages, frameworks, key libraries).',
      '- How the repos fit together (APIs, data flow, auth, deployment).',
      '- Signals useful for coding tasks: architecture/layering, testing setup, notable conventions or gotchas.',
      '',
      fingerprints.join('\n\n---\n\n'),
    ].join('\n');

    const model = modelFor(config, this.encryptionKey);
    const response = await model.invoke(prompt);
    const raw = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c) => (typeof c === 'string' ? c : ('text' in c ? c.text : ''))).join('')
        : String(response.content);
    const projectContext = raw.slice(0, CONTEXT_MAX_LENGTH);

    await this.prisma.aiConfig.update({
      where: { projectId },
      data: { projectContext },
    });

    return { projectContext };
  }
}
