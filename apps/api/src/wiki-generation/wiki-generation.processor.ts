import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AgentsService } from '../agents/agents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WikiService } from '../wiki/wiki.service';
import type { WikiCtx } from '../agents/specialist/wiki.agent';

interface JobData {
  jobId: string;
  projectId: string;
  sections: string[];
}

@Processor('wiki-generation', { concurrency: 1 })
export class WikiGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(WikiGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agents: AgentsService,
    private readonly notifications: NotificationsService,
    private readonly wiki: WikiService,
  ) {
    super();
  }

  private async setStep(jobId: string, projectId: string, step: string) {
    await this.prisma.wikiGenerationJob.update({ where: { id: jobId }, data: { step } });
    this.notifications.notifyProject(projectId, 'wiki-generation:progress', { jobId, step });
  }

  async process(job: Job<JobData>): Promise<void> {
    const { jobId, projectId, sections } = job.data;

    await this.prisma.wikiGenerationJob.update({
      where: { id: jobId },
      data: { status: 'running' },
    });

    const abort = new AbortController();
    this.wiki.abortControllers.set(jobId, abort);

    try {
      // step: pulling — require at least one cloned + indexed repo.
      await this.setStep(jobId, projectId, 'pulling');
      const repos = await this.prisma.repository.findMany({
        where: { projectId, cloneStatus: 'cloned' },
      });
      if (repos.length === 0) throw new Error('Clone a repository first');
      const repoPaths = repos
        .filter((r) => r.indexStatus === 'indexed' && r.workspacePath)
        .map((r) => r.workspacePath as string);
      if (repoPaths.length === 0) throw new Error('Index a repository first');

      await this.setStep(jobId, projectId, 'building-graph');

      // step: generating — one agent run per section, resumable (skip done).
      await this.setStep(jobId, projectId, 'generating');
      const wikiPath = this.wiki.getWikiPath(projectId);

      for (const section of sections) {
        if (abort.signal.aborted) throw new Error('Aborted');

        const prog = await this.prisma.wikiSectionProgress.findUnique({
          where: { jobId_section: { jobId, section } },
        });
        if (prog?.status === 'done') continue; // resume: skip finished sections

        await this.prisma.wikiSectionProgress.update({
          where: { jobId_section: { jobId, section } },
          data: { status: 'generating', error: null, pages: 0 },
        });
        this.notifications.notifyProject(projectId, 'wiki-generation:section', {
          jobId, section, status: 'generating',
        });

        try {
          // wipe-then-write: clear stale pages for this section.
          const sectionDir = join(wikiPath, section);
          await rm(sectionDir, { recursive: true, force: true });
          await mkdir(sectionDir, { recursive: true });

          const onStep = (line: string) =>
            this.notifications.notifyProject(projectId, 'wiki-generation:stream', {
              jobId, section, line,
            });

          const ctx: WikiCtx = {
            projectId, section, repoPaths, sectionDir, signal: abort.signal,
          };
          const pages = (await this.agents.run('wiki', ctx, onStep)) as number;

          await this.prisma.wikiSectionProgress.update({
            where: { jobId_section: { jobId, section } },
            data: { status: 'done', pages },
          });
          this.notifications.notifyProject(projectId, 'wiki-generation:section', {
            jobId, section, status: 'done', pages,
          });
        } catch (err) {
          if (abort.signal.aborted) throw err;
          const error = err instanceof Error ? err.message : String(err);
          this.logger.error(`Wiki section "${section}" failed for job ${jobId}: ${error}`);
          await this.prisma.wikiSectionProgress.update({
            where: { jobId_section: { jobId, section } },
            data: { status: 'error', error },
          });
          this.notifications.notifyProject(projectId, 'wiki-generation:section', {
            jobId, section, status: 'error', error,
          });
          // continue: one section failing must not kill the rest.
        }
      }

      await this.setStep(jobId, projectId, 'writing-meta');
      await this.prisma.wikiConfig.upsert({
        where: { projectId },
        create: { projectId, sections, lastGeneratedAt: new Date() },
        update: { lastGeneratedAt: new Date() },
      });
      await this.prisma.wikiGenerationJob.update({
        where: { id: jobId },
        data: { status: 'completed', endedAt: new Date() },
      });
      this.notifications.notifyProject(projectId, 'wiki-generation:completed', { jobId });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const aborted = abort.signal.aborted;
      await this.prisma.wikiGenerationJob.update({
        where: { id: jobId },
        data: { status: aborted ? 'aborted' : 'failed', error, endedAt: new Date() },
      }).catch(() => undefined);
      if (!aborted) {
        this.notifications.notifyProject(projectId, 'wiki-generation:failed', { jobId, error });
      }
      throw err;
    } finally {
      this.wiki.abortControllers.delete(jobId);
    }
  }
}
