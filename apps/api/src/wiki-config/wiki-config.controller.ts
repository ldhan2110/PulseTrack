import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { WikiConfigService } from './wiki-config.service';
import { UpsertWikiConfigDto } from './dto/upsert-wiki-config.dto';

@Controller('projects/:projectId/wiki/config')
@UseGuards(JwtAuthGuard)
export class WikiConfigController {
  constructor(
    private readonly service: WikiConfigService,
  ) {}

  @Get()
  @UseGuards(ProjectRolesGuard)
  async findOne(@Param('projectId') projectId: string) {
    const config = await this.service.findByProjectId(projectId);
    if (!config) return null;
    return config;
  }

  @Put()
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  async upsert(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertWikiConfigDto,
  ) {
    return this.service.upsert(projectId, dto);
  }
}
