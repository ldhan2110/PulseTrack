import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { AiTaskGenerationService } from './ai-task-generation.service';

@Controller('projects/:projectId/ai/generate-tasks')
@UseGuards(JwtAuthGuard)
export class AiTaskGenerationController {
  constructor(private readonly service: AiTaskGenerationService) {}

  @Post()
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  @UseInterceptors(
    FilesInterceptor('documents', 5, { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  generate(
    @Param('projectId') projectId: string,
    @Body() body: { prompt: string; breakIntoSubTasks?: string },
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.service.enqueue(
      projectId,
      { prompt: body.prompt, breakIntoSubTasks: body.breakIntoSubTasks === 'true' },
      files,
    );
  }

  @Get(':jobId')
  @UseGuards(ProjectRolesGuard)
  getResult(@Param('jobId') jobId: string) {
    return this.service.getResult(jobId);
  }
}
