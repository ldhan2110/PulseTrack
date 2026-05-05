import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';

const execFileAsync = promisify(execFile);

const IN_PROGRESS_STATUSES = ['preparing', 'fixing', 'pushing', 'creating-mr'];
const ORPHAN_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class AiBugFixCleanupService {
  private readonly logger = new Logger(AiBugFixCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 */15 * * * *')
  async cleanupOrphanedWorktrees(): Promise<void> {
    const cutoff = new Date(Date.now() - ORPHAN_THRESHOLD_MS);

    const orphans = await this.prisma.aiBugFix.findMany({
      where: {
        status: { in: IN_PROGRESS_STATUSES },
        createdAt: { lt: cutoff },
      },
      include: {
        project: {
          include: { repositoryConfig: true },
        },
      },
    });

    for (const orphan of orphans) {
      this.logger.warn(`Cleaning up orphaned AI fix: ${orphan.id}`);

      if (orphan.worktreePath && orphan.project.repositoryConfig?.workspacePath) {
        try {
          await execFileAsync('git', ['worktree', 'remove', orphan.worktreePath, '--force'], {
            cwd: orphan.project.repositoryConfig.workspacePath,
            timeout: 30_000,
          });
        } catch (e) {
          this.logger.warn(`Worktree removal failed for ${orphan.id}: ${(e as Error).message}`);
        }
      }

      if (orphan.branchName && orphan.project.repositoryConfig?.workspacePath) {
        try {
          await execFileAsync('git', ['branch', '-D', orphan.branchName], {
            cwd: orphan.project.repositoryConfig.workspacePath,
            timeout: 10_000,
          });
        } catch {
          // Branch may not exist
        }
      }

      await this.prisma.aiBugFix.update({
        where: { id: orphan.id },
        data: {
          status: 'failed',
          errorMessage: 'Timed out — orphan cleanup',
          completedAt: new Date(),
        },
      });
    }

    if (orphans.length > 0) {
      this.logger.log(`Cleaned up ${orphans.length} orphaned AI fix job(s)`);
    }
  }
}
