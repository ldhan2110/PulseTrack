// apps/api/src/ai-testcase-generation/ai-testcase-generation.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { GenerateTestCasesDto } from './dto/generate-testcases.dto';
import type { TestCaseGenerationJobData } from './dto/generate-testcases.dto';

@Controller('projects/:projectId/ai/generate-testcases')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class AiTestCaseGenerationController {
  constructor(
    @InjectQueue('ai-testcase-generation') private readonly queue: Queue,
  ) {}

  @Post()
  @RequirePermission('testCases', 'create')
  @UseInterceptors(
    FilesInterceptor('documents', 5, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const jobId = randomUUID();
          (_req as any).__generationJobId = (_req as any).__generationJobId || jobId;
          const dir = join(process.cwd(), 'uploads', 'ai-testcase-generation', (_req as any).__generationJobId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.txt', '.md', '.png', '.jpg', '.jpeg'];
        const ext = extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`File type ${ext} not supported`), false);
        }
      },
    }),
  )
  async generate(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateTestCasesDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    const uploadedFilePaths = (files ?? []).map((f) => f.path);
    const jobId = (req as any).__generationJobId || randomUUID();

    const jobData: TestCaseGenerationJobData = {
      projectId,
      userId: req.user.id,
      prompt: dto.prompt,
      taskIds: dto.taskIds,
      generateSteps: dto.generateSteps ?? true,
      scanCodebase: dto.scanCodebase ?? false,
      uploadedFilePaths,
    };

    const job = await this.queue.add('generate', jobData, {
      jobId,
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 86400 },
    });

    return { jobId: job.id };
  }

  @Get(':jobId')
  async getJobResult(
    @Param('jobId') jobId: string,
  ) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException('Generation job not found');

    const state = await job.getState();

    if (state === 'completed') {
      return { status: 'completed', testCases: job.returnvalue?.testCases ?? [] };
    }
    if (state === 'failed') {
      return { status: 'failed', error: job.failedReason ?? 'Unknown error' };
    }

    const progress = job.progress as { step?: string; streamText?: string } | undefined;
    return {
      status: state,
      step: progress?.step ?? 'queued',
      ...(progress?.streamText ? { streamText: progress.streamText } : {}),
    };
  }
}
