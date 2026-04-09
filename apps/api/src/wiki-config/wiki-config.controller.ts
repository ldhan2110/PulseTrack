import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { WikiConfigService } from './wiki-config.service';
import { UpsertWikiConfigDto } from './dto/upsert-wiki-config.dto';

@Controller('projects/:projectId/wiki/config')
@UseGuards(JwtAuthGuard)
export class WikiConfigController {
  constructor(private readonly service: WikiConfigService) {}

  @Get()
  @UseGuards(ProjectRolesGuard)
  findOne(@Param('projectId') projectId: string) {
    return this.service.findByProjectId(projectId);
  }

  @Put()
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  upsert(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertWikiConfigDto,
  ) {
    return this.service.upsert(projectId, dto);
  }
}
