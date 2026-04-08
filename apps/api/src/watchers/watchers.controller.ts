import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { WatchersService } from './watchers.service';
import { AddWatchersDto } from './dto/add-watchers.dto';
import type { EntityType } from '@prisma/client';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WatchersController {
  constructor(private watchersService: WatchersService) {}

  @Get('tasks/:taskId/watchers')
  findTaskWatchers(@Param('taskId') taskId: string) {
    return this.watchersService.findAll('TASK' as EntityType, taskId);
  }

  @Post('tasks/:taskId/watchers')
  addTaskWatchers(@Param('taskId') taskId: string, @Body() dto: AddWatchersDto) {
    return this.watchersService.addWatchers('TASK' as EntityType, taskId, dto.userIds);
  }

  @Delete('tasks/:taskId/watchers/:userId')
  removeTaskWatcher(@Param('taskId') taskId: string, @Param('userId') userId: string) {
    return this.watchersService.removeWatcher('TASK' as EntityType, taskId, userId);
  }

  @Get('bugs/:bugId/watchers')
  findBugWatchers(@Param('bugId') bugId: string) {
    return this.watchersService.findAll('BUG' as EntityType, bugId);
  }

  @Post('bugs/:bugId/watchers')
  addBugWatchers(@Param('bugId') bugId: string, @Body() dto: AddWatchersDto) {
    return this.watchersService.addWatchers('BUG' as EntityType, bugId, dto.userIds);
  }

  @Delete('bugs/:bugId/watchers/:userId')
  removeBugWatcher(@Param('bugId') bugId: string, @Param('userId') userId: string) {
    return this.watchersService.removeWatcher('BUG' as EntityType, bugId, userId);
  }
}
