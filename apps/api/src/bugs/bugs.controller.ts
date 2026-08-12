import {
  Body, Controller, Delete, Get, Header,
  Param, Patch, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { BugsService } from './bugs.service';
import { CreateBugDto } from './dto/create-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';
import { BulkImportBugsDto } from './dto/bulk-import-bugs.dto';
import { LinkTasksDto } from './dto/link-tasks.dto';
import { CreateFixTaskDto } from './dto/create-fix-task.dto';

@Controller('projects/:projectId/bugs')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class BugsController {
  constructor(
    private bugsService: BugsService,
  ) {}

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query('severity') severity?: string,
    @Query('workflowStatusId') workflowStatusId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('reporterId') reporterId?: string,
    @Query('search') search?: string,
  ) {
    return this.bugsService.findAll(projectId, {
      severity, workflowStatusId, assigneeId, reporterId, search,
    });
  }

  @Post()
  @RequirePermission('bugs', 'create')
  create(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: CreateBugDto,
  ) {
    return this.bugsService.create(projectId, req.user.id, dto);
  }

  @Get('export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportExcel(
    @Param('projectId') projectId: string,
    @Query('workflowStatusId') workflowStatusId?: string,
    @Query('severity') severity?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('reporterId') reporterId?: string,
    @Query('search') search?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.bugsService.exportExcel(projectId, {
      workflowStatusId, severity, assigneeId, reporterId, search,
    });
    const date = new Date().toISOString().split('T')[0];
    res!.set({
      'Content-Disposition': `attachment; filename="bugs-${date}.xlsx"`,
    });
    res!.end(buffer);
  }

  @Get('by-key/:bugKey')
  findByKey(@Param('bugKey') bugKey: string) {
    return this.bugsService.findByBugKey(bugKey);
  }

  @Get(':bugId/history')
  getHistory(@Param('bugId') bugId: string) {
    return this.bugsService.getHistory(bugId);
  }

  @Post('bulk-import')
  @RequirePermission('bugs', 'create')
  bulkImport(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: BulkImportBugsDto,
  ) {
    return this.bugsService.bulkImport(projectId, req.user.id, dto);
  }

  @Post(':bugId/tasks')
  @RequirePermission('bugs', 'update')
  linkTasks(
    @Param('bugId') bugId: string,
    @Body() dto: LinkTasksDto,
  ) {
    return this.bugsService.linkTasks(bugId, dto.taskIds);
  }

  @Post(':bugId/create-fix-task')
  @RequirePermission('bugs', 'update')
  createFixTask(
    @Param('projectId') projectId: string,
    @Param('bugId') bugId: string,
    @Req() req: any,
    @Body() dto: CreateFixTaskDto,
  ) {
    return this.bugsService.createFixTask(bugId, projectId, req.user.id, dto);
  }

  @Delete(':bugId/tasks/:taskId')
  @RequirePermission('bugs', 'update')
  unlinkTask(
    @Param('bugId') bugId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.bugsService.unlinkTask(bugId, taskId);
  }

  @Get(':bugId/tasks')
  getLinkedTasks(@Param('bugId') bugId: string) {
    return this.bugsService.getLinkedTasks(bugId);
  }

  @Get(':bugId')
  findOne(@Param('bugId') bugId: string) {
    return this.bugsService.findOne(bugId);
  }

  @Patch(':bugId')
  @RequirePermission('bugs', 'update')
  update(@Param('bugId') bugId: string, @Body() dto: UpdateBugDto, @Req() req: any) {
    return this.bugsService.update(bugId, dto, req.user.id);
  }

  @Delete(':bugId')
  @RequirePermission('bugs', 'delete')
  delete(@Param('bugId') bugId: string) {
    return this.bugsService.delete(bugId);
  }
}
