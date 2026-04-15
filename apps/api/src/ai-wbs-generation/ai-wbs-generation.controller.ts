// apps/api/src/ai-wbs-generation/ai-wbs-generation.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { AiWbsGenerationService } from './ai-wbs-generation.service';
import { GenerateWbsDto, WbsChatDto } from './dto/generate-wbs.dto';
import type { WbsGenerationJobData } from './dto/generate-wbs.dto';

@Controller('projects/:projectId/ai')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class AiWbsGenerationController {
  constructor(
    @InjectQueue('ai-wbs-generation') private readonly queue: Queue,
    private readonly aiService: AiWbsGenerationService,
  ) {}

  @Post('generate-wbs')
  @UseInterceptors(
    FileInterceptor('document', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const jobId = randomUUID();
          (_req as any).__wbsJobId = (_req as any).__wbsJobId || jobId;
          const dir = join(process.cwd(), 'uploads', 'ai-wbs-generation', (_req as any).__wbsJobId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['.xlsx', '.csv', '.txt', '.pdf', '.docx', '.md'];
        const ext = extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`File type ${ext} not supported`), false);
        }
      },
    }),
  )
  async generateWbs(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateWbsDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const uploadedFilePaths = file ? [file.path] : [];
    const jobId = (req as any).__wbsJobId || randomUUID();

    // Parse features if sent as JSON string (FormData)
    let features: string[] = [];
    if (dto.features) {
      if (typeof dto.features === 'string') {
        try {
          features = JSON.parse(dto.features as string);
        } catch {
          features = [dto.features as string];
        }
      } else {
        features = dto.features;
      }
    }

    // Parse teamRoles if sent as JSON string (FormData)
    let teamRoles: { role: string; count: number }[] | undefined;
    if (dto.teamRoles) {
      if (typeof dto.teamRoles === 'string') {
        try {
          teamRoles = JSON.parse(dto.teamRoles as string);
        } catch {
          teamRoles = undefined;
        }
      } else {
        teamRoles = dto.teamRoles;
      }
    }

    const jobData: WbsGenerationJobData = {
      projectId,
      userId: req.user.id,
      instructions: dto.instructions,
      features,
      teamSize: dto.teamSize,
      teamRoles,
      projectStartDate: dto.projectStartDate,
      targetEndDate: dto.targetEndDate,
      methodology: dto.methodology,
      sprintDuration: dto.sprintDuration,
      scanCodebase: dto.scanCodebase ?? false,
      uploadedFilePaths,
    };

    const job = await this.queue.add('generate-wbs', jobData, {
      jobId,
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 86400 },
    });

    return { jobId: job.id };
  }

  @Get('wbs-generation/:jobId')
  async getJobResult(@Param('jobId') jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException('WBS generation job not found');

    const state = await job.getState();

    if (state === 'completed') {
      return { status: 'completed', phases: job.returnvalue?.phases ?? [] };
    }
    if (state === 'failed') {
      return { status: 'failed', error: job.failedReason ?? 'Unknown error' };
    }

    const progress = job.progress as { step?: string; streamText?: string } | undefined;
    return {
      status: state,
      step: progress?.step ?? 'queued',
      ...(progress?.streamText ? { rawText: progress.streamText } : {}),
    };
  }

  @Post('wbs-chat')
  async wbsChat(
    @Param('projectId') projectId: string,
    @Body() dto: WbsChatDto,
    @Req() req: any,
  ) {
    const config = await this.aiService.getProjectAiConfig(projectId);

    const prompt = this.aiService.buildChatPrompt(
      dto.currentWbs,
      dto.message,
      dto.chatHistory,
    );

    const args = this.aiService.buildCliArgs(config.provider, config.model, prompt);
    const env = this.aiService.buildCliEnv(config.provider, config.apiKey);

    const rawOutput = await new Promise<string>((resolve, reject) => {
      const child = spawn(config.cli, args, {
        cwd: process.cwd(),
        env: { ...process.env, ...env } as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const stdoutChunks: string[] = [];
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        reject(new Error('WBS chat timed out after 300s'));
      }, 300_000);

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk.toString());
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (killed) return;
        if (code === 0 || code === null) {
          resolve(stdoutChunks.join(''));
        } else {
          reject(new Error(`CLI exited with code ${code}`));
        }
      });
    });

    const result = this.aiService.parseAndValidateOutput(rawOutput);
    return { phases: result.phases };
  }
}
