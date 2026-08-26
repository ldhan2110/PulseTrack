import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
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
      // CodeGraph writes ./.codegraph/ inside the repo. `init` builds it the
      // first time; `index --quiet` rebuilds it on re-pull (index no-ops if the
      // repo was never init'd, so pick by whether .codegraph/ exists).
      const bin = process.env.CODEGRAPH_BIN || 'codegraph';
      const args = existsSync(join(repo.workspacePath, '.codegraph'))
        ? ['index', repo.workspacePath, '--quiet']
        : ['init', repo.workspacePath];
      await execFileAsync(bin, args, {
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
