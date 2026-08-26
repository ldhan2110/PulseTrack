import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, maskToken } from '../common/encryption.util';
import { UpsertAiConfigDto } from './dto/upsert-ai-config.dto';

type ContextJobStatus = 'waiting' | 'active' | 'completed' | 'failed';

export interface ContextJobResult {
  status: ContextJobStatus;
  step?: string;
  error?: string;
}

@Injectable()
export class AiConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('ai-project-context') private readonly contextQueue: Queue,
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

  /**
   * Enqueue a context-generation job. Deterministic jobId `ctx-<projectId>` +
   * removeOnComplete/Fail means a re-click while a run is active resolves to the
   * same job (BullMQ rejects a duplicate id), and a new run is allowed once the
   * previous one finished. Returns the active/new jobId either way.
   */
  async generateContext(projectId: string): Promise<{ jobId: string }> {
    const jobId = `ctx-${projectId}`;
    await this.contextQueue.add(
      'generate',
      { projectId },
      { jobId, removeOnComplete: true, removeOnFail: true },
    );
    return { jobId };
  }

  async getContextJobResult(jobId: string): Promise<ContextJobResult> {
    const job = await this.contextQueue.getJob(jobId);
    if (!job) return { status: 'failed', error: 'Job not found' };

    const state = await job.getState();
    if (state === 'completed') return { status: 'completed' };
    if (state === 'failed') return { status: 'failed', error: job.failedReason ?? 'Generation failed' };
    if (state === 'active') {
      const progress = job.progress as { step?: string };
      return { status: 'active', step: progress?.step };
    }
    return { status: 'waiting' };
  }
}
