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
import { CreateSubTaskDto } from './dto/create-subtask.dto';

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

  @Post(':taskId/subtasks')
  @ProjectRoles('pm', 'ba', 'developer')
  createSubTask(
    @Param('taskId') taskId: string,
    @Body() dto: CreateSubTaskDto,
  ) {
    return this.tasksService.createSubTask(taskId, dto);
  }

  @Patch(':taskId/subtasks/:subTaskId')
  @ProjectRoles('pm', 'ba', 'developer')
  updateSubTask(
    @Param('subTaskId') subTaskId: string,
    @Body() dto: CreateSubTaskDto,
  ) {
    return this.tasksService.updateSubTask(subTaskId, dto);
  }

  @Delete(':taskId/subtasks/:subTaskId')
  @ProjectRoles('pm', 'ba')
  deleteSubTask(@Param('subTaskId') subTaskId: string) {
    return this.tasksService.deleteSubTask(subTaskId);
  }
}
