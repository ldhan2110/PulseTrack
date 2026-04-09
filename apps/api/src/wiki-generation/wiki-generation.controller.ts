import {
  Controller, Post, Get, Param, Body, Req, UseGuards, NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { WikiConfigService } from '../wiki-config/wiki-config.service';
import { TriggerWikiGenerationDto, WikiGenerationJobData } from './dto/generate-wiki.dto';

@Controller('projects/:projectId/wiki/generate')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WikiGenerationController {
  constructor(
    @InjectQueue('wiki-generation') private readonly queue: Queue,
    private readonly wikiConfigService: WikiConfigService,
  ) {}

  @Post()
  @RequirePermission('projectSettings', 'update')
  async generate(
    @Param('projectId') projectId: string,
    @Body() dto: TriggerWikiGenerationDto,
    @Req() req: any,
  ) {
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
