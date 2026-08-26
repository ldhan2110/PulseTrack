import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ProjectContextCtx } from '../agents/specialist/project-context.agent';

interface JobData {
  projectId: string;
}

@Processor('ai-project-context', { concurrency: 3 })
export class AiConfigContextProcessor extends WorkerHost {
  private readonly logger = new Logger(AiConfigContextProcessor.name);

  constructor(
    private readonly agents: AgentsService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<JobData>): Promise<{ projectContext: string }> {
    const { projectId } = job.data;
    const jobId = String(job.id);

    try {
      const onStep = (step: string) => {
        void job.updateProgress({ step });
        this.notifications.notifyProject(projectId, 'project-context:progress', {
          jobId,
          step,
        });
      };
      const ctx: ProjectContextCtx = { projectId };
      const projectContext = (await this.agents.run('project-context', ctx, onStep)) as string;

      await this.prisma.aiConfig.update({
        where: { projectId },
        data: { projectContext },
      });

      this.notifications.notifyProject(projectId, 'project-context:completed', { jobId });
      return { projectContext };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Context generation failed for job ${jobId}: ${error}`);
      this.notifications.notifyProject(projectId, 'project-context:failed', { jobId, error });
      throw err;
    }
  }
}
