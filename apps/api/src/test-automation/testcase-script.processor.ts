import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TestAutomationService } from './test-automation.service';
import type { TestcaseScriptCtx } from '../agents/specialist/testcase-script.agent';

interface JobData {
  testCaseId: string;
  projectId: string;
}

@Processor('ai-testcase-script', { concurrency: 5 })
export class TestcaseScriptProcessor extends WorkerHost {
  private readonly logger = new Logger(TestcaseScriptProcessor.name);

  constructor(
    private readonly agents: AgentsService,
    private readonly notifications: NotificationsService,
    private readonly automationService: TestAutomationService,
  ) {
    super();
  }

  async process(job: Job<JobData>): Promise<{ script: string }> {
    const { testCaseId, projectId } = job.data;
    const jobId = String(job.id);

    try {
      const onStep = (step: string) => {
        void job.updateProgress({ step });
        this.notifications.notifyProject(projectId, 'testcase-script:progress', {
          jobId,
          step,
        });
      };
      const ctx: TestcaseScriptCtx = { testCaseId };
      const script = (await this.agents.run('testcase-script', ctx, onStep)) as string;

      await this.automationService.upsert(testCaseId, { script });

      this.notifications.notifyProject(projectId, 'testcase-script:completed', { jobId });
      return { script };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Script generation failed for job ${jobId}: ${error}`);
      this.notifications.notifyProject(projectId, 'testcase-script:failed', { jobId, error });
      throw err;
    }
  }
}
