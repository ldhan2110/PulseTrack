import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, maskToken } from '../common/encryption.util';
import { UpsertPlannerAiConfigDto } from './dto/upsert-planner-ai-config.dto';

@Injectable()
export class PlannerAiConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  async findByProjectId(projectId: string) {
    const config = await this.prisma.plannerAiConfig.findUnique({
      where: { projectId },
    });
    if (!config) return null;
    return { ...config, apiKey: maskToken(config.apiKey) };
  }

  async upsert(projectId: string, dto: UpsertPlannerAiConfigDto) {
    const encryptedKey = encrypt(dto.apiKey, this.encryptionKey);

    const config = await this.prisma.plannerAiConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        provider: dto.provider,
        model: dto.model,
        apiKey: encryptedKey,
      },
      update: {
        provider: dto.provider,
        model: dto.model,
        apiKey: encryptedKey,
      },
    });

    return { ...config, apiKey: maskToken(dto.apiKey) };
  }
}
