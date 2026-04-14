import {
  Controller, Get, Post, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { WbsDependencyService } from './wbs-dependency.service';
import { CreateDependencyDto } from './dto/create-dependency.dto';

@Controller()
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WbsDependencyController {
  constructor(private readonly depService: WbsDependencyService) {}

  @Get('projects/:projectId/wbs/dependencies')
  list(@Param('projectId') projectId: string) {
    return this.depService.listDependencies(projectId);
  }

  @Post('projects/:projectId/wbs/dependencies')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateDependencyDto,
  ) {
    return this.depService.createDependency(projectId, dto);
  }

  @Delete('projects/:projectId/wbs/dependencies/:depId')
  remove(@Param('depId') depId: string) {
    return this.depService.deleteDependency(depId);
  }
}
