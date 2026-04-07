import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { ProjectRoles } from '../auth/project-roles.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('projects/:projectId/tasks')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.tasksService.findAll(projectId);
  }

  @Post()
  @ProjectRoles('pm', 'ba')
  create(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(projectId, req.user.id, dto);
  }

  @Get('by-key/:taskKey')
  findByKey(@Param('taskKey') taskKey: string) {
    return this.tasksService.findByTaskKey(taskKey);
  }

  @Get(':taskId/history')
  getHistory(@Param('taskId') taskId: string) {
    return this.tasksService.getHistory(taskId);
  }

  @Get(':taskId')
  findOne(@Param('taskId') taskId: string) {
    return this.tasksService.findOne(taskId);
  }

  @Patch(':taskId')
  @ProjectRoles('pm', 'ba', 'developer')
  update(
    @Param('taskId') taskId: string,
    @Req() req: any,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(taskId, dto, req.user.id);
  }

  @Delete(':taskId')
  @ProjectRoles('pm')
  delete(@Param('taskId') taskId: string) {
    return this.tasksService.delete(taskId);
  }

}
