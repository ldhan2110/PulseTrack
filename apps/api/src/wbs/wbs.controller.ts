import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { WbsService } from './wbs.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { ReorderDto } from './dto/reorder.dto';

@Controller()
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WbsController {
  constructor(private readonly wbsService: WbsService) {}

  // ─── Phases ──────────────────────────────────────────────

  @Get('projects/:projectId/wbs/phases')
  listPhases(@Param('projectId') projectId: string) {
    return this.wbsService.listPhases(projectId);
  }

  @Post('projects/:projectId/wbs/phases')
  createPhase(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePhaseDto,
  ) {
    return this.wbsService.createPhase(projectId, dto);
  }

  @Patch('projects/:projectId/wbs/phases/:phaseId')
  updatePhase(
    @Param('phaseId') phaseId: string,
    @Body() dto: UpdatePhaseDto,
  ) {
    return this.wbsService.updatePhase(phaseId, dto);
  }

  @Delete('projects/:projectId/wbs/phases/:phaseId')
  deletePhase(@Param('phaseId') phaseId: string) {
    return this.wbsService.deletePhase(phaseId);
  }

  @Patch('projects/:projectId/wbs/phases/reorder')
  reorderPhases(
    @Param('projectId') projectId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.wbsService.reorderPhases(projectId, dto);
  }

  // ─── Tasks ───────────────────────────────────────────────

  @Post('wbs/phases/:phaseId/tasks')
  createTask(
    @Param('phaseId') phaseId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.wbsService.createTask(phaseId, dto);
  }

  @Patch('wbs/phases/:phaseId/tasks/:taskId')
  updateTask(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.wbsService.updateTask(taskId, dto);
  }

  @Delete('wbs/phases/:phaseId/tasks/:taskId')
  deleteTask(@Param('taskId') taskId: string) {
    return this.wbsService.deleteTask(taskId);
  }

  @Patch('wbs/phases/:phaseId/tasks/reorder')
  reorderTasks(
    @Param('phaseId') phaseId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.wbsService.reorderTasks(phaseId, dto);
  }

  // ─── Subtasks ────────────────────────────────────────────

  @Post('wbs/tasks/:taskId/subtasks')
  createSubtask(
    @Param('taskId') taskId: string,
    @Body() dto: CreateSubtaskDto,
  ) {
    return this.wbsService.createSubtask(taskId, dto);
  }

  @Patch('wbs/tasks/:taskId/subtasks/:subtaskId')
  updateSubtask(
    @Param('subtaskId') subtaskId: string,
    @Body() dto: UpdateSubtaskDto,
  ) {
    return this.wbsService.updateSubtask(subtaskId, dto);
  }

  @Delete('wbs/tasks/:taskId/subtasks/:subtaskId')
  deleteSubtask(@Param('subtaskId') subtaskId: string) {
    return this.wbsService.deleteSubtask(subtaskId);
  }

  @Patch('wbs/tasks/:taskId/subtasks/reorder')
  reorderSubtasks(
    @Param('taskId') taskId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.wbsService.reorderSubtasks(taskId, dto);
  }
}
