import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { TimeLogsService } from './time-logs.service';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { ProjectRoles } from '../auth/project-roles.decorator';

@Controller('projects/:projectId/tasks/:taskId/time-logs')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TimeLogsController {
  constructor(private readonly timeLogsService: TimeLogsService) {}

  @Post()
  @ProjectRoles('pm', 'ba', 'developer', 'qc')
  create(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: any,
    @Body() dto: CreateTimeLogDto,
  ) {
    return this.timeLogsService.create(projectId, taskId, req.user.id, dto);
  }

  @Get()
  findAll(@Param('taskId') taskId: string) {
    return this.timeLogsService.findAll(taskId);
  }

  @Delete(':timeLogId')
  @ProjectRoles('pm', 'ba', 'developer', 'qc')
  remove(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('timeLogId') timeLogId: string,
    @Req() req: any,
  ) {
    return this.timeLogsService.remove(projectId, taskId, timeLogId, req.user.id, req.user.projectRole);
  }
}
