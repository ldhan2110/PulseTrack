import {
  Body, Controller, Delete, Get,
  Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { BugsService } from './bugs.service';
import { CreateBugDto } from './dto/create-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';
import { BulkImportBugsDto } from './dto/bulk-import-bugs.dto';

@Controller('projects/:projectId/bugs')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class BugsController {
  constructor(private bugsService: BugsService) {}

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query('severity') severity?: string,
    @Query('workflowStatusId') workflowStatusId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('parentTaskId') parentTaskId?: string,
    @Query('reporterId') reporterId?: string,
    @Query('search') search?: string,
  ) {
    return this.bugsService.findAll(projectId, {
      severity, workflowStatusId, assigneeId, parentTaskId, reporterId, search,
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
