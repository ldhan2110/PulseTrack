import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join, resolve, isAbsolute } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { encrypt, maskToken } from '../common/encryption.util';
import { CreateRepositoryDto } from './dto/create-repository.dto';

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
    const repos = await this.prisma.repository.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return repos.map((r) => ({ ...r, accessToken: maskToken(r.accessToken) }));
  }

  async add(projectId: string, dto: CreateRepositoryDto) {
    const existing = await this.prisma.repository.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Repository "${dto.name}" already exists in this project`);

    const encryptedToken = encrypt(dto.accessToken, this.encryptionKey);

    const repo = await this.prisma.repository.create({
      data: {
        projectId,
        name: dto.name,
        repoUrl: dto.repoUrl,
        accessToken: encryptedToken,
        provider: dto.provider ?? 'gitlab',
        branch: dto.branch || null,
        cloneStatus: 'cloning',
      },
    });

    await this.cloneQueue.add(
      'clone',
      { projectId, repositoryId: repo.id },
      { attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
    );

    this.notifications.notifyProject(projectId, 'repository:status', {
      projectId,
      repositoryId: repo.id,
      cloneStatus: 'cloning',
    });

    return { ...repo, accessToken: maskToken(repo.accessToken) };
  }

  async remove(projectId: string, repositoryId: string) {
    const repo = await this.prisma.repository.findUnique({ where: { id: repositoryId } });
    if (!repo || repo.projectId !== projectId) throw new NotFoundException('Repository not found');

    await this.prisma.repository.delete({ where: { id: repositoryId } });

    if (repo.workspacePath && existsSync(repo.workspacePath)) {
      await rm(repo.workspacePath, { recursive: true, force: true });
    } else {
      const configDir = this.config.get<string>('WORKSPACE_DIR', 'workspaces');
      const baseDir = isAbsolute(configDir) ? configDir : resolve(process.cwd(), '..', '..', configDir);
      const dir = join(baseDir, projectId, 'projects', repo.name);
      if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
    }
  }
}
