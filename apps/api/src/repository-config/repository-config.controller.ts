import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { RepositoryConfigService } from './repository-config.service';
import { UpsertRepositoryConfigDto } from './dto/upsert-repository-config.dto';

@Controller('projects/:projectId/settings/repository')
@UseGuards(JwtAuthGuard)
export class RepositoryConfigController {
  constructor(private readonly service: RepositoryConfigService) {}

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
    @Body() dto: UpsertRepositoryConfigDto,
  ) {
    return this.service.upsert(projectId, dto);
  }

  @Delete()
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  remove(@Param('projectId') projectId: string) {
    return this.service.remove(projectId);
  }
}
