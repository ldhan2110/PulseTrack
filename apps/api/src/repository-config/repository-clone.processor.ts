import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
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
  ) {
    super();
  }

  async process(job: Job<{ projectId: string }>): Promise<void> {
    const { projectId } = job.data;
    const configDir = this.config.get<string>('WORKSPACE_DIR', 'workspaces');
    const baseDir = isAbsolute(configDir) ? configDir : resolve(process.cwd(), '..', '..', configDir);
    const workspacePath = join(baseDir, projectId);

    try {
      const repoConfig = await this.prisma.repositoryConfig.findUnique({
        where: { projectId },
      });
      if (!repoConfig) return;

      // Clean existing workspace if present
      if (existsSync(workspacePath)) {
        await rm(workspacePath, { recursive: true, force: true });
      }
      await mkdir(workspacePath, { recursive: true });

      // Decrypt token and build authenticated URL
      const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
      const token = decrypt(repoConfig.accessToken, encryptionKey);
      const url = new URL(repoConfig.repoUrl);
      url.username = 'oauth2';
      url.password = token;

      await execFileAsync(GIT_PATH, ['clone', url.toString(), workspacePath], {
        timeout: 300_000, // 5 minutes
      });

      await this.prisma.repositoryConfig.update({
        where: { projectId },
        data: { cloneStatus: 'cloned', workspacePath, cloneError: null },
      });

      this.notifications.notifyProject(projectId, 'repository:status', {
        projectId,
        cloneStatus: 'cloned',
        workspacePath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown clone error';
      await this.prisma.repositoryConfig.update({
        where: { projectId },
        data: { cloneStatus: 'failed', cloneError: message },
      });

      this.notifications.notifyProject(projectId, 'repository:status', {
        projectId,
        cloneStatus: 'failed',
        cloneError: message,
      });
    }
  }
}
