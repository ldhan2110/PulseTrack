import { Injectable, NotFoundException, Inject, forwardRef, BadGatewayException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

const EVIDENCE_DIR = path.join(process.cwd(), 'uploads', 'test-executions');
import {
  LiveAutomationProcessor,
  ExecutionAutomationProcessor,
} from './automation-run.processor';

export type RunMode = 'live' | 'execution';

export interface AutomationJobData {
  runId: string;
  automationId: string;
  script: string;
  timeoutMs: number;
  projectId: string;
  runnerId: string;
  mode: RunMode;
  executionCaseId?: string;
}

@Injectable()
export class AutomationRunService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('test-automation-live') private readonly liveQueue: Queue,
    @InjectQueue('test-automation-execution') private readonly executionQueue: Queue,
    @Inject(forwardRef(() => LiveAutomationProcessor))
    private readonly liveProcessor: LiveAutomationProcessor,
    @Inject(forwardRef(() => ExecutionAutomationProcessor))
    private readonly executionProcessor: ExecutionAutomationProcessor,
  ) {}

  async triggerRun(testCaseId: string, runnerId: string, mode: RunMode = 'live', executionCaseId?: string) {
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
      throw new BadGatewayException('A run is already in progress for this test case');
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
      timeoutMs: automation.timeoutMs,
      projectId: automation.testCase.projectId,
      runnerId,
      mode,
      executionCaseId,
    };

    const queue = mode === 'live' ? this.liveQueue : this.executionQueue;
    await queue.add('execute', jobData, {
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

    // If already terminal, return current status instead of throwing
    if (run.status !== 'RUNNING') {
      return { cancelled: false, status: run.status };
    }

    await this.prisma.automationRun.update({
      where: { id: runId },
      data: { status: 'CANCELLED' },
    });

    // Close the active browser to kill the running script (lives in one lane)
    await this.liveProcessor.cancelRun(runId);
    await this.executionProcessor.cancelRun(runId);

    // Remove from queue if still waiting
    const liveJob = await this.liveQueue.getJob(runId);
    if (liveJob) await liveJob.remove().catch(() => {});
    const execJob = await this.executionQueue.getJob(runId);
    if (execJob) await execJob.remove().catch(() => {});

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

  /**
   * Attribute a finished server-side execution run to its execution case:
   * map status → result and persist. On failure, store the screenshot (if any)
   * as an evidence attachment. Best-effort — never throws into the worker.
   */
  async completeExecutionCaseRun(
    executionCaseId: string,
    runnerId: string,
    status: 'PASSED' | 'FAILED' | 'TIMEOUT',
    screenshotBase64?: string,
  ) {
    const result = status === 'PASSED' ? 'PASS' : 'FAIL';
    const updated = await this.prisma.testExecutionCase
      .update({
        where: { id: executionCaseId },
        data: { result, executedById: runnerId, executedAt: new Date() },
      })
      .catch(() => null);

    // If all cases in the execution are now run, mark the execution COMPLETED
    if (updated) {
      const allCases = await this.prisma.testExecutionCase.findMany({
        where: { executionId: updated.executionId },
        select: { result: true },
      });
      const allDone = allCases.every((c) => c.result !== 'NOT_RUN' && c.result !== 'IN_PROGRESS');
      await this.prisma.testExecution
        .update({
          where: { id: updated.executionId },
          data: { status: allDone ? 'COMPLETED' : 'IN_PROGRESS' },
        })
        .catch(() => {});
    }

    if (screenshotBase64) {
      try {
        const dir = path.join(EVIDENCE_DIR, executionCaseId);
        fs.mkdirSync(dir, { recursive: true });
        const storedName = `${randomUUID()}.jpg`;
        const buf = Buffer.from(screenshotBase64, 'base64');
        fs.writeFileSync(path.join(dir, storedName), buf);
        const prefix = result === 'PASS' ? 'pass' : 'failure';
        await this.prisma.testExecutionAttachment.create({
          data: {
            executionCaseId,
            uploaderId: runnerId,
            filename: `${prefix}-${Date.now()}.jpg`,
            storedName,
            mimeType: 'image/jpeg',
            size: buf.length,
          },
        });
      } catch {
        // evidence is best-effort
      }
    }
  }
}
