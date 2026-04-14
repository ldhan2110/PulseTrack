import {
  Controller, Post, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { WbsBacklogService } from './wbs-backlog.service';
import { LinkBacklogDto } from './dto/link-backlog.dto';

@Controller()
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WbsBacklogController {
  constructor(private readonly backlogService: WbsBacklogService) {}

  @Post('wbs/tasks/:taskId/link-backlog')
  linkTask(
    @Param('taskId') taskId: string,
    @Body() dto: LinkBacklogDto,
  ) {
    return this.backlogService.linkTask(taskId, dto);
  }

  @Delete('wbs/tasks/:taskId/link-backlog')
  unlinkTask(@Param('taskId') taskId: string) {
    return this.backlogService.unlinkTask(taskId);
  }

  @Post('wbs/subtasks/:subtaskId/link-backlog')
  linkSubtask(
    @Param('subtaskId') subtaskId: string,
    @Body() dto: LinkBacklogDto,
  ) {
    return this.backlogService.linkSubtask(subtaskId, dto);
  }

  @Delete('wbs/subtasks/:subtaskId/link-backlog')
  unlinkSubtask(@Param('subtaskId') subtaskId: string) {
    return this.backlogService.unlinkSubtask(subtaskId);
  }
}
