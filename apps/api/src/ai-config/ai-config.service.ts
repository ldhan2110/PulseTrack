import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, maskToken } from '../common/encryption.util';
import { AgentsService } from '../agents/agents.service';
import type { ProjectContextCtx } from '../agents/specialist/project-context.agent';
import { UpsertAiConfigDto } from './dto/upsert-ai-config.dto';

@Injectable()
export class AiConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly agents: AgentsService,
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
    const ctx: ProjectContextCtx = { projectId };
    const projectContext = (await this.agents.run('project-context', ctx)) as string;

    await this.prisma.aiConfig.update({
      where: { projectId },
      data: { projectContext },
    });

    return { projectContext };
  }
}
