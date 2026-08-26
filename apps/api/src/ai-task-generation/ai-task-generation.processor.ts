import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { BaUserStoryCtx, GeneratedTask } from '../agents/specialist/ba-user-story.agent';

interface JobData {
  projectId: string;
  prompt: string;
  breakIntoSubTasks: boolean;
  documents: string[];
}

@Processor('ai-task-generation', { concurrency: 3 })
export class AiTaskGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiTaskGenerationProcessor.name);

  constructor(
    private readonly agents: AgentsService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<JobData>): Promise<GeneratedTask[]> {
    const { projectId, prompt, breakIntoSubTasks, documents } = job.data;
    const jobId = String(job.id);

    await job.updateProgress({ step: 'generating' });
    this.notifications.notifyProject(projectId, 'ai-generation:progress', {
      jobId,
      step: 'generating',
    });

    try {
      const ctx: BaUserStoryCtx = { projectId, prompt, breakIntoSubTasks, documents };
      const tasks = (await this.agents.run('ba-user-story', ctx)) as GeneratedTask[];
      this.notifications.notifyProject(projectId, 'ai-generation:completed', {
        jobId,
        taskCount: tasks.length,
      });
      return tasks;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Task generation failed for job ${jobId}: ${error}`);
      this.notifications.notifyProject(projectId, 'ai-generation:failed', { jobId, error });
      throw err;
    }
  }
}
