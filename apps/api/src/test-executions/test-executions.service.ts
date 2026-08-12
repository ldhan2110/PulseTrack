import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationRunService } from '../test-automation/automation-run.service';
import { CreateTestExecutionDto } from './dto/create-test-execution.dto';
import { UpdateResultDto } from './dto/update-result.dto';
import type { TestExecutionStatus, TestResultStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'test-executions');

const USER_SELECT = { id: true, username: true, email: true, name: true, imageUrl: true };

@Injectable()
export class TestExecutionsService {
  constructor(
    private prisma: PrismaService,
    private automationRuns: AutomationRunService,
  ) {}

  async findAll(projectId: string) {
    const executions = await this.prisma.testExecution.findMany({
      where: { projectId },
      include: {
        assignee: { select: USER_SELECT },
        sprint: { select: { id: true, name: true } },
        cases: { select: { result: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return executions.map((exec) => {
      const { cases, ...rest } = exec;
      return { ...rest, stats: this.computeStats(cases.map((c) => c.result)) };
    });
  }

  async findOne(executionId: string) {
    return this.prisma.testExecution.findUnique({
      where: { id: executionId },
      include: {
        assignee: { select: USER_SELECT },
        sprint: { select: { id: true, name: true } },
        cases: {
          include: {
            testCase: {
              include: {
                steps: { orderBy: { position: 'asc' as const } },
                links: true,
              },
            },
            executedBy: { select: USER_SELECT },
            attachments: {
              include: {
                uploader: { select: USER_SELECT },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });
  }

  async create(projectId: string, dto: CreateTestExecutionDto, userId: string) {
    // Merge suite members + cherry-picked IDs
    const testCaseIdSet = new Set<string>(dto.testCaseIds ?? []);

    if (dto.suiteId) {
      const members = await this.prisma.testSuiteMember.findMany({
        where: { suiteId: dto.suiteId },
        select: { testCaseId: true },
      });
      members.forEach((m) => testCaseIdSet.add(m.testCaseId));
    }

    const testCaseIds = Array.from(testCaseIdSet);

    const execution = await this.prisma.$transaction(async (tx) => {
      // Atomically increment testExecutionSeq to generate executionKey
      const project = await tx.project.update({
        where: { id: projectId },
        data: { testExecutionSeq: { increment: 1 } },
        select: { prefix: true, testExecutionSeq: true },
      });
      const executionKey = project.prefix
        ? `${project.prefix}-TX-${project.testExecutionSeq}`
        : null;

      return tx.testExecution.create({
        data: {
          projectId,
          executionKey,
          name: dto.name,
          assigneeId: dto.assigneeId,
          sprintId: dto.sprintId,
          cases: {
            create: testCaseIds.map((testCaseId) => ({ testCaseId })),
          },
        },
        include: {
          assignee: { select: USER_SELECT },
          sprint: { select: { id: true, name: true } },
          cases: {
            include: {
              testCase: { select: { id: true, testCaseKey: true, title: true } },
            },
          },
        },
      });
    });

    // Auto-run cases that have an automation script (fire-and-forget, execution lane)
    const scripted = await this.prisma.testCaseAutomation.findMany({
      where: { testCaseId: { in: testCaseIds } },
      select: { testCaseId: true },
    });
    const scriptedSet = new Set(scripted.map((a) => a.testCaseId));
    const scriptedCases = execution.cases.filter((c) => scriptedSet.has(c.testCase.id));

    if (scriptedCases.length > 0) {
      // Mark running so the list/detail shows progress before the worker finishes
      await this.prisma.testExecutionCase.updateMany({
        where: { id: { in: scriptedCases.map((c) => c.id) } },
        data: { result: 'IN_PROGRESS' },
      });
      await this.prisma.testExecution.update({
        where: { id: execution.id },
        data: { status: 'IN_PROGRESS' },
      });
      await Promise.all(
        scriptedCases.map((c) =>
          this.automationRuns
            .triggerRun(c.testCase.id, userId, 'execution', c.id)
            .catch(() => {}),
        ),
      );
    }

    return execution;
  }

  async findByKey(executionKey: string) {
    return this.prisma.testExecution.findUnique({
      where: { executionKey },
      include: {
        assignee: { select: USER_SELECT },
        sprint: { select: { id: true, name: true } },
        cases: {
          include: {
            testCase: {
              include: {
                steps: { orderBy: { position: 'asc' as const } },
                links: true,
              },
            },
            executedBy: { select: USER_SELECT },
            attachments: {
              include: {
                uploader: { select: USER_SELECT },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });
  }

  async updateStatus(executionId: string, status: TestExecutionStatus) {
    return this.prisma.testExecution.update({
      where: { id: executionId },
      data: { status },
    });
  }

  async addCases(executionId: string, testCaseIds: string[]) {
    // Skip duplicates
    const existing = await this.prisma.testExecutionCase.findMany({
      where: { executionId, testCaseId: { in: testCaseIds } },
      select: { testCaseId: true },
    });
    const existingIds = new Set(existing.map((c) => c.testCaseId));
    const newIds = testCaseIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) return { added: 0 };

    await this.prisma.testExecutionCase.createMany({
      data: newIds.map((testCaseId) => ({ executionId, testCaseId })),
    });

    return { added: newIds.length };
  }

  async bulkDelete(ids: string[]) {
    return this.prisma.$transaction(async (tx) => {
      // Find all execution case IDs for these executions
      const execCases = await tx.testExecutionCase.findMany({
        where: { executionId: { in: ids } },
        select: { id: true },
      });
      const execCaseIds = execCases.map((c) => c.id);

      // Delete attachments, then cases, then executions
      if (execCaseIds.length > 0) {
        await tx.testExecutionAttachment.deleteMany({ where: { executionCaseId: { in: execCaseIds } } });
      }
      await tx.testExecutionCase.deleteMany({ where: { executionId: { in: ids } } });
      const result = await tx.testExecution.deleteMany({ where: { id: { in: ids } } });
      return { deleted: result.count };
    });
  }

  async delete(executionId: string) {
    return this.prisma.testExecution.delete({ where: { id: executionId } });
  }

  async updateResult(executionCaseId: string, userId: string, dto: UpdateResultDto) {
    const updated = await this.prisma.testExecutionCase.update({
      where: { id: executionCaseId },
      data: {
        result: dto.result,
        notes: dto.notes,
        executedById: userId,
        executedAt: new Date(),
      },
      include: {
        testCase: { select: { id: true, testCaseKey: true, title: true } },
        executedBy: { select: USER_SELECT },
      },
    });

    // Auto-update execution status
    const allCases = await this.prisma.testExecutionCase.findMany({
      where: { executionId: updated.executionId },
      select: { result: true },
    });

    const allDone = allCases.every((c) => c.result !== 'NOT_RUN' && c.result !== 'IN_PROGRESS');
    const anyStarted = allCases.some((c) => c.result !== 'NOT_RUN');

    let newStatus: TestExecutionStatus | undefined;
    if (allDone) {
      newStatus = 'COMPLETED';
    } else if (anyStarted) {
      newStatus = 'IN_PROGRESS';
    }

    if (newStatus) {
      await this.prisma.testExecution.update({
        where: { id: updated.executionId },
        data: { status: newStatus },
      });
    }

    return updated;
  }

  async createAttachment(executionCaseId: string, uploaderId: string, file: Express.Multer.File) {
    return this.prisma.testExecutionAttachment.create({
      data: {
        executionCaseId,
        uploaderId,
        filename: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
      },
      include: {
        uploader: { select: USER_SELECT },
      },
    });
  }

  async deleteAttachment(attachmentId: string) {
    const attachment = await this.prisma.testExecutionAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const filePath = path.join(UPLOAD_DIR, attachment.executionCaseId, attachment.storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return this.prisma.testExecutionAttachment.delete({ where: { id: attachmentId } });
  }

  async getAttachmentFilePath(attachmentId: string): Promise<{ filePath: string; filename: string; mimeType: string }> {
    const attachment = await this.prisma.testExecutionAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const filePath = path.join(UPLOAD_DIR, attachment.executionCaseId, attachment.storedName);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found on disk');

    return { filePath, filename: attachment.filename, mimeType: attachment.mimeType };
  }

  private computeStats(results: TestResultStatus[]) {
    const total = results.length;
    const counts = {
      PASS: 0,
      FAIL: 0,
      BLOCKED: 0,
      SKIP: 0,
      NOT_RUN: 0,
      IN_PROGRESS: 0,
    };
    for (const r of results) {
      counts[r] = (counts[r] ?? 0) + 1;
    }
    const completed = counts.PASS + counts.FAIL + counts.BLOCKED + counts.SKIP;
    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, ...counts, completed, completionPercent };
  }
}
