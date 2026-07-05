import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';

export interface AiProjectConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  projectContext: string | null;
  workspacePath: string;
}

@Injectable()
export class AiConfigLoader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async load(projectId: string): Promise<AiProjectConfig> {
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { projectId },
    });
    if (!aiConfig) {
      throw new BadRequestException(
        'AI configuration not found. Save AI settings first.',
      );
    }

    const repoConfig = await this.prisma.repositoryConfig.findUnique({
      where: { projectId },
    });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException(
        'Repository must be cloned before using AI features.',
      );
    }

    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      baseUrl: aiConfig.baseUrl,
      projectContext: aiConfig.projectContext,
      workspacePath: repoConfig.workspacePath!,
    };
  }
}
