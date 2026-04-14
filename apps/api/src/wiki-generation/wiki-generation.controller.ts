import {
  Controller, Post, Get, Param, Body, Req, UseGuards, NotFoundException, BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { WikiConfigService } from '../wiki-config/wiki-config.service';
import { WikiGenerationProcessor } from './wiki-generation.processor';
import { TriggerWikiGenerationDto, WikiGenerationJobData } from './dto/generate-wiki.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('projects/:projectId/wiki/generate')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WikiGenerationController {
  constructor(
    @InjectQueue('wiki-generation') private readonly queue: Queue,
    private readonly wikiConfigService: WikiConfigService,
    private readonly prisma: PrismaService,
    private readonly processor: WikiGenerationProcessor,
    private readonly notifications: NotificationsService,
  ) {}

  /** Fail-fast: validate repo clone + AI config before enqueueing */
  private async validatePrerequisites(projectId: string) {
    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException('Repository must be cloned before generating wiki.');
    }

    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) {
      throw new BadRequestException('AI configuration not found. Save AI settings first.');
    }
  }

  /** Check if any wiki-generation job is currently active (across all projects) */
  private async getActiveGenerationJob() {
    const active = await this.queue.getJobs(['active', 'waiting']);
    return active.find((j) => j.name === 'generate-wiki') ?? null;
  }

  @Post()
  @RequirePermission('projectSettings', 'update')
  async generate(
    @Param('projectId') projectId: string,
    @Body() dto: TriggerWikiGenerationDto,
    @Req() req: any,
  ) {
    await this.validatePrerequisites(projectId);

    const existingJob = await this.getActiveGenerationJob();
    if (existingJob) {
      throw new ConflictException('Wiki generation is already in progress. Please wait for it to complete.');
    }

    const config = await this.wikiConfigService.findByProjectId(projectId);
    if (!config) throw new NotFoundException('Wiki configuration not found. Save wiki settings first.');

    const sections = dto.section ? [dto.section] : config.sections;

    const jobData: WikiGenerationJobData = {
      projectId,
      userId: req.user.id,
      sections,
    };

    const job = await this.queue.add('generate-wiki', jobData, {
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 86400 },
    });

    return { jobId: job.id };
  }

  @Post(':section')
  @RequirePermission('projectSettings', 'update')
  async generateSection(
    @Param('projectId') projectId: string,
    @Param('section') section: string,
    @Req() req: any,
  ) {
    await this.validatePrerequisites(projectId);

    const existingJob = await this.getActiveGenerationJob();
    if (existingJob) {
      throw new ConflictException('Wiki generation is already in progress. Please wait for it to complete.');
    }

    const config = await this.wikiConfigService.findByProjectId(projectId);
    if (!config) throw new NotFoundException('Wiki configuration not found.');

    const jobData: WikiGenerationJobData = {
      projectId,
      userId: req.user.id,
      sections: [section],
    };

    const job = await this.queue.add('generate-wiki', jobData, {
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 86400 },
    });

    return { jobId: job.id };
  }

  @Get('active')
  async getActiveJob(@Param('projectId') projectId: string) {
    const active = await this.queue.getJobs(['active', 'waiting']);
    const job = active.find(
      (j) => j.name === 'generate-wiki' && j.data?.projectId === projectId,
    );

    if (!job) return { active: false };

    const state = await job.getState();
    const progress = job.progress as { step?: string; streamText?: string } | undefined;

    return {
      active: true,
      jobId: job.id,
      status: state,
      step: progress?.step ?? 'queued',
      sections: job.data.sections ?? [],
    };
  }

  @Post('abort/:jobId')
  @RequirePermission('projectSettings', 'update')
  async abort(
    @Param('projectId') projectId: string,
    @Param('jobId') jobId: string,
    @Req() req: any,
  ) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException('Generation job not found');

    const state = await job.getState();

    // Kill any active child processes
    this.processor.abortJob(jobId);

    if (state === 'active') {
      await job.moveToFailed(new Error('Aborted by user'), job.token ?? '0', false);
    } else if (state === 'waiting' || state === 'delayed') {
      await job.remove();
    } else {
      throw new ConflictException(`Job is already ${state}`);
    }

    // Notify frontend
    this.notifications.notifyUser(req.user.id, 'wiki-generation:failed', {
      jobId,
      error: 'Generation aborted by user',
    });

    return { aborted: true };
  }

  @Get('status/:jobId')
  async getStatus(@Param('jobId') jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException('Generation job not found');

    const state = await job.getState();

    if (state === 'completed') {
      return { status: 'completed', result: job.returnvalue };
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
