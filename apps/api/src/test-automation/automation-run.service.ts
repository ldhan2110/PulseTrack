import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AutomationJobData {
  runId: string;
  automationId: string;
  script: string;
  baseUrl: string | null;
  timeoutMs: number;
  projectId: string;
  runnerId: string;
}

@Injectable()
export class AutomationRunService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('test-automation') private readonly queue: Queue,
  ) {}

  async triggerRun(testCaseId: string, runnerId: string) {
    const automation = await this.prisma.testCaseAutomation.findUnique({
      where: { testCaseId },
      include: { testCase: { select: { projectId: true } } },
    });

    if (!automation) {
      throw new NotFoundException('No automation script found for this test case');
    }

    const activeRun = await this.prisma.automationRun.findFirst({
      where: { automationId: automation.id, status: 'RUNNING' },
    });
    if (activeRun) {
      throw new ConflictException('A run is already in progress for this test case');
    }

    const run = await this.prisma.automationRun.create({
      data: {
        automationId: automation.id,
        runnerId,
        status: 'RUNNING',
      },
    });

    const jobData: AutomationJobData = {
      runId: run.id,
      automationId: automation.id,
      script: automation.script,
      baseUrl: automation.baseUrl,
      timeoutMs: automation.timeoutMs,
      projectId: automation.testCase.projectId,
      runnerId,
    };

    await this.queue.add('execute', jobData, {
      jobId: run.id,
      removeOnComplete: true,
      removeOnFail: true,
    });

    return run;
  }

  async cancelRun(runId: string) {
    const run = await this.prisma.automationRun.findUnique({
      where: { id: runId },
    });
    if (!run) throw new NotFoundException('Run not found');
    if (run.status !== 'RUNNING') {
      throw new ConflictException('Run is not active');
    }

    await this.prisma.automationRun.update({
      where: { id: runId },
      data: { status: 'CANCELLED' },
    });

    const job = await this.queue.getJob(runId);
    if (job) await job.remove();

    return { cancelled: true };
  }

  async getRunHistory(automationId: string) {
    return this.prisma.automationRun.findMany({
      where: { automationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        runner: {
          select: { id: true, name: true, username: true, imageUrl: true },
        },
      },
    });
  }

  async updateRunResult(
    runId: string,
    data: { status: 'PASSED' | 'FAILED' | 'TIMEOUT'; duration: number; logs?: Prisma.InputJsonValue; error?: string },
  ) {
    return this.prisma.automationRun.update({
      where: { id: runId },
      data,
    });
  }
}
