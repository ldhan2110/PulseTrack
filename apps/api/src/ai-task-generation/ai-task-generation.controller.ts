// apps/api/src/ai-task-generation/ai-task-generation.controller.ts
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
import { GenerateTasksDto } from './dto/generate-tasks.dto';
import type { GenerationJobData } from './dto/generate-tasks.dto';

@Controller('projects/:projectId/ai/generate-tasks')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class AiTaskGenerationController {
  constructor(
    @InjectQueue('ai-task-generation') private readonly queue: Queue,
  ) {}

  @Post()
  @RequirePermission('tasks', 'create')
  @UseInterceptors(
    FilesInterceptor('documents', 5, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const jobId = randomUUID();
          // Store jobId on request for later use
          (_req as any).__generationJobId = (_req as any).__generationJobId || jobId;
          const dir = join(process.cwd(), 'uploads', 'ai-generation', (_req as any).__generationJobId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
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
    @Body() dto: GenerateTasksDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    const uploadedFilePaths = (files ?? []).map((f) => f.path);
    const jobId = (req as any).__generationJobId || randomUUID();

    const jobData: GenerationJobData = {
      projectId,
      userId: req.user.id,
      prompt: dto.prompt,
      scanCodebase: dto.scanCodebase ?? false,
      breakIntoSubTasks: dto.breakIntoSubTasks ?? false,
      uploadedFilePaths,
    };

    const job = await this.queue.add('generate', jobData, {
      jobId,
      removeOnComplete: { age: 86400 }, // Keep for 24h
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
      return { status: 'completed', tasks: job.returnvalue?.tasks ?? [] };
    }
    if (state === 'failed') {
      return { status: 'failed', error: job.failedReason ?? 'Unknown error' };
    }

    // Include current step and streaming text from job progress so frontend can recover state
    const progress = job.progress as { step?: string; streamText?: string } | undefined;
    return {
      status: state,
      step: progress?.step ?? 'queued',
      ...(progress?.streamText ? { streamText: progress.streamText } : {}),
    };
  }
}
