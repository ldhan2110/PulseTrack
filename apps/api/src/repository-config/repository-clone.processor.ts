import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { rm, mkdir } from 'fs/promises';
import { join, resolve, isAbsolute } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { GIT_PATH } from '../common/git-path.util';
import { decrypt } from '../common/encryption.util';

const execFileAsync = promisify(execFile);

@Processor('repository-clone')
export class RepositoryCloneProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @InjectQueue('repository-index') private readonly indexQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ projectId: string; repositoryId: string }>): Promise<void> {
    const { projectId, repositoryId } = job.data;
    const repo = await this.prisma.repository.findUnique({ where: { id: repositoryId } });
    if (!repo || repo.projectId !== projectId) return;

    const configDir = this.config.get<string>('WORKSPACE_DIR', 'workspaces');
    const baseDir = isAbsolute(configDir) ? configDir : resolve(process.cwd(), '..', '..', configDir);
    const safeName = repo.name.replace(/[^A-Za-z0-9_-]/g, '');
    const workspacePath = join(baseDir, projectId, 'projects', safeName);

    try {
      // Clean existing workspace if present
      if (existsSync(workspacePath)) {
        await rm(workspacePath, { recursive: true, force: true });
      }
      await mkdir(workspacePath, { recursive: true });

      // Decrypt token and build authenticated URL
      const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
      const token = decrypt(repo.accessToken, encryptionKey);
      const url = new URL(repo.repoUrl);
      url.username = 'oauth2';
      url.password = token;

      const cloneArgs = ['clone'];
      if (repo.branch) cloneArgs.push('--branch', repo.branch);
      cloneArgs.push(url.toString(), workspacePath);

      await execFileAsync(GIT_PATH, cloneArgs, {
        timeout: 300_000, // 5 minutes
      });

      await this.prisma.repository.update({
        where: { id: repositoryId },
        data: { cloneStatus: 'cloned', workspacePath, cloneError: null },
      });

      this.notifications.notifyProject(projectId, 'repository:status', {
        projectId,
        repositoryId,
        cloneStatus: 'cloned',
        workspacePath,
      });

      // Kick off background code-graph indexing now that the clone exists.
      await this.indexQueue.add(
        'index',
        { projectId, repositoryId },
        { attempts: 1, removeOnComplete: true },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown clone error';
      await this.prisma.repository.update({
        where: { id: repositoryId },
        data: { cloneStatus: 'failed', cloneError: message },
      });

      this.notifications.notifyProject(projectId, 'repository:status', {
        projectId,
        repositoryId,
        cloneStatus: 'failed',
        cloneError: message,
      });
    }
  }
}
