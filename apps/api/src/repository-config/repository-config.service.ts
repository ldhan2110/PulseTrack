import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join, resolve, isAbsolute } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GIT_PATH } from '../common/git-path.util';
import { encrypt, maskToken } from '../common/encryption.util';
import { CreateRepositoryDto } from './dto/create-repository.dto';

const execFileAsync = promisify(execFile);

/** Derive a safe repo name from the clone URL's last path segment (strip .git). */
function repoNameFromUrl(repoUrl: string): string {
  const last = repoUrl.replace(/\.git$/, '').replace(/\/+$/, '').split('/').pop() ?? '';
  const name = last.replace(/[^A-Za-z0-9_-]/g, '-');
  if (!name) throw new ConflictException('Could not derive a repository name from the URL');
  return name;
}

@Injectable()
export class RepositoryConfigService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('repository-clone') private readonly cloneQueue: Queue,
    @InjectQueue('repository-index') private readonly indexQueue: Queue,
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
    const name = repoNameFromUrl(dto.repoUrl);

    const existing = await this.prisma.repository.findUnique({
      where: { projectId_name: { projectId, name } },
    });
    if (existing) throw new ConflictException(`Repository "${name}" already exists in this project`);

    const encryptedToken = encrypt(dto.accessToken, this.encryptionKey);

    const repo = await this.prisma.repository.create({
      data: {
        projectId,
        name,
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

  async pull(projectId: string, repositoryId: string) {
    const repo = await this.prisma.repository.findUnique({ where: { id: repositoryId } });
    if (!repo || repo.projectId !== projectId) throw new NotFoundException('Repository not found');
    if (repo.cloneStatus !== 'cloned' || !repo.workspacePath || !existsSync(repo.workspacePath)) {
      throw new ConflictException('Repository is not cloned yet');
    }

    await execFileAsync(GIT_PATH, ['pull'], { cwd: repo.workspacePath, timeout: 300_000 });

    await this.indexQueue.add(
      'index',
      { projectId, repositoryId },
      { attempts: 1, removeOnComplete: true },
    );

    return { pulled: true };
  }

  async remove(projectId: string, repositoryId: string) {
    const repo = await this.prisma.repository.findUnique({ where: { id: repositoryId } });
    if (!repo || repo.projectId !== projectId) throw new NotFoundException('Repository not found');

    await this.prisma.repository.delete({ where: { id: repositoryId } });

    if (repo.workspacePath && existsSync(repo.workspacePath)) {
      // Deregister from ~/.gitnexus/registry.json before deleting the folder
      // (clean operates on the cwd repo). Best-effort — never block removal.
      await execFileAsync('gitnexus', ['clean'], {
        cwd: repo.workspacePath,
        timeout: 60_000,
      }).catch(() => undefined);
      await rm(repo.workspacePath, { recursive: true, force: true });
    } else {
      const configDir = this.config.get<string>('WORKSPACE_DIR', 'workspaces');
      const baseDir = isAbsolute(configDir) ? configDir : resolve(process.cwd(), '..', '..', configDir);
      const dir = join(baseDir, projectId, 'projects', repo.name);
      if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
    }
  }
}
