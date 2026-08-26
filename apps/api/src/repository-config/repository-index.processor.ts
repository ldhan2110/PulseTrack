import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const execFileAsync = promisify(execFile);

@Processor('repository-index')
export class RepositoryIndexProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<{ projectId: string; repositoryId: string }>): Promise<void> {
    const { projectId, repositoryId } = job.data;
    const repo = await this.prisma.repository.findUnique({ where: { id: repositoryId } });
    if (!repo || repo.projectId !== projectId) return;

    // Guard: only index a successfully cloned repo with a real workspace.
    if (repo.cloneStatus !== 'cloned' || !repo.workspacePath || !existsSync(repo.workspacePath)) {
      return;
    }

    await this.prisma.repository.update({
      where: { id: repositoryId },
      data: { indexStatus: 'indexing', indexError: null },
    });
    this.notifications.notifyProject(projectId, 'repository:status', {
      projectId,
      repositoryId,
      indexStatus: 'indexing',
    });

    try {
      // `gitnexus analyze` builds ./.gitnexus/ and registers the repo in
      // ~/.gitnexus/registry.json (shared, same user as the API process).
      await execFileAsync('gitnexus', ['analyze'], {
        cwd: repo.workspacePath,
        timeout: 900_000, // 15 minutes — indexing is heavier than clone
      });

      await this.prisma.repository.update({
        where: { id: repositoryId },
        data: { indexStatus: 'indexed', indexError: null },
      });
      this.notifications.notifyProject(projectId, 'repository:status', {
        projectId,
        repositoryId,
        indexStatus: 'indexed',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown index error';
      await this.prisma.repository.update({
        where: { id: repositoryId },
        data: { indexStatus: 'failed', indexError: message },
      });
      this.notifications.notifyProject(projectId, 'repository:status', {
        projectId,
        repositoryId,
        indexStatus: 'failed',
        indexError: message,
      });
    }
  }
}
