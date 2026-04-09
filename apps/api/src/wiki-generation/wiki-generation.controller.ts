import {
  Controller, Post, Get, Param, Body, Req, UseGuards, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { WikiConfigService } from '../wiki-config/wiki-config.service';
import { TriggerWikiGenerationDto, WikiGenerationJobData } from './dto/generate-wiki.dto';

@Controller('projects/:projectId/wiki/generate')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WikiGenerationController {
  constructor(
    @InjectQueue('wiki-generation') private readonly queue: Queue,
    private readonly wikiConfigService: WikiConfigService,
    private readonly prisma: PrismaService,
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

  @Post()
  @RequirePermission('projectSettings', 'update')
  async generate(
    @Param('projectId') projectId: string,
    @Body() dto: TriggerWikiGenerationDto,
    @Req() req: any,
  ) {
    await this.validatePrerequisites(projectId);

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
