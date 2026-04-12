import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { encrypt, maskToken } from '../common/encryption.util';
import { UpsertRepositoryConfigDto } from './dto/upsert-repository-config.dto';

@Injectable()
export class RepositoryConfigService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('repository-clone') private readonly cloneQueue: Queue,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  async findByProjectId(projectId: string) {
    const config = await this.prisma.repositoryConfig.findUnique({
      where: { projectId },
    });
    if (!config) return null;
    return { ...config, accessToken: maskToken(config.accessToken) };
  }

  async upsert(projectId: string, dto: UpsertRepositoryConfigDto) {
    const encryptedToken = encrypt(dto.accessToken, this.encryptionKey);

    const config = await this.prisma.repositoryConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        repoUrl: dto.repoUrl,
        accessToken: encryptedToken,
        provider: dto.provider ?? 'gitlab',
        cloneStatus: 'cloning',
      },
      update: {
        repoUrl: dto.repoUrl,
        accessToken: encryptedToken,
        provider: dto.provider ?? 'gitlab',
        cloneStatus: 'cloning',
        cloneError: null,
        workspacePath: null,
      },
    });

    await this.cloneQueue.add('clone', { projectId }, { attempts: 2, backoff: { type: 'exponential', delay: 5000 } });

    this.notifications.notifyProject(projectId, 'repository:status', {
      projectId,
      cloneStatus: 'cloning',
    });

    return { ...config, accessToken: maskToken(dto.accessToken) };
  }

  async remove(projectId: string) {
    const existing = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (!existing) throw new NotFoundException('Repository config not found');
    await this.prisma.repositoryConfig.delete({ where: { projectId } });
  }
}
