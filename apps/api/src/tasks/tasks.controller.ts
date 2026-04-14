import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { TasksService } from './tasks.service';
import { BugsService } from '../bugs/bugs.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('projects/:projectId/tasks')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TasksController {
  constructor(
    private tasksService: TasksService,
    private bugsService: BugsService,
  ) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.tasksService.findAll(projectId);
  }

  @Post()
  @RequirePermission('tasks', 'create')
  create(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(projectId, req.user.id, dto);
  }

  @Get('export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportExcel(
    @Param('projectId') projectId: string,
    @Query('workflowStatusId') workflowStatusId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('sprintId') sprintId?: string,
    @Query('priority') priority?: string,
    @Query('plannedStartFrom') plannedStartFrom?: string,
    @Query('plannedStartTo') plannedStartTo?: string,
    @Query('plannedEndFrom') plannedEndFrom?: string,
    @Query('plannedEndTo') plannedEndTo?: string,
    @Query('overdue') overdue?: string,
    @Query('search') search?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.tasksService.exportExcel(projectId, {
      workflowStatusId, assigneeId, sprintId, priority,
      plannedStartFrom, plannedStartTo, plannedEndFrom, plannedEndTo,
      overdue, search,
    });
    const date = new Date().toISOString().split('T')[0];
    res!.set({
      'Content-Disposition': `attachment; filename="tasks-${date}.xlsx"`,
    });
    res!.end(buffer);
  }

  @Get('by-key/:taskKey')
  findByKey(@Param('taskKey') taskKey: string) {
    return this.tasksService.findByTaskKey(taskKey);
  }

  @Get(':taskId/history')
  getHistory(@Param('taskId') taskId: string) {
    return this.tasksService.getHistory(taskId);
  }

  @Get(':taskId/bugs')
  getLinkedBugs(@Param('taskId') taskId: string) {
    return this.bugsService.getBugsByTaskId(taskId);
  }

  @Get(':taskId')
  findOne(@Param('taskId') taskId: string) {
    return this.tasksService.findOne(taskId);
  }

  @Patch(':taskId')
  @RequirePermission('tasks', 'update')
  update(
    @Param('taskId') taskId: string,
    @Req() req: any,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(taskId, dto, req.user.id);
  }

  @Delete(':taskId')
  @RequirePermission('tasks', 'delete')
  delete(@Param('taskId') taskId: string) {
    return this.tasksService.delete(taskId);
  }

}
