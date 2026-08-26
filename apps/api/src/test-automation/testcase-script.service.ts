import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

type Status = 'waiting' | 'active' | 'completed' | 'failed';

export interface ScriptJobResult {
  status: Status;
  step?: string;
  error?: string;
}

@Injectable()
export class TestcaseScriptService {
  constructor(
    @InjectQueue('ai-testcase-script') private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enqueue a script-generation job. Deterministic jobId `script-<testCaseId>` +
   * removeOnComplete/Fail means a re-click while a run is active resolves to the
   * same job (BullMQ rejects a duplicate id), and a new run is allowed once the
   * previous one finished. Returns the active/new jobId either way.
   */
  async enqueue(testCaseId: string): Promise<{ jobId: string }> {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id: testCaseId },
      select: { projectId: true },
    });
    if (!testCase) throw new NotFoundException('Test case not found');

    const jobId = `script-${testCaseId}`;
    await this.queue.add(
      'generate',
      { testCaseId, projectId: testCase.projectId },
      { jobId, removeOnComplete: true, removeOnFail: true },
    );
    return { jobId };
  }

  async getResult(jobId: string): Promise<ScriptJobResult> {
    const job = await this.queue.getJob(jobId);
    if (!job) return { status: 'failed', error: 'Job not found' };

    const state = await job.getState();
    if (state === 'completed') return { status: 'completed' };
    if (state === 'failed') return { status: 'failed', error: job.failedReason ?? 'Generation failed' };
    if (state === 'active') {
      const progress = job.progress as { step?: string };
      return { status: 'active', step: progress?.step };
    }
    return { status: 'waiting' };
  }
}
