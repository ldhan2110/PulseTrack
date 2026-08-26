import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { RepositoryConfigService } from './repository-config.service';
import { CreateRepositoryDto } from './dto/create-repository.dto';

@Controller('projects/:projectId/settings/repository')
@UseGuards(JwtAuthGuard)
export class RepositoryConfigController {
  constructor(private readonly service: RepositoryConfigService) {}

  @Get()
  @UseGuards(ProjectRolesGuard)
  list(@Param('projectId') projectId: string) {
    return this.service.findByProjectId(projectId);
  }

  @Post()
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  add(
    @Param('projectId') projectId: string,
    @Body() dto: CreateRepositoryDto,
  ) {
    return this.service.add(projectId, dto);
  }

  @Post(':repositoryId/pull')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  pull(
    @Param('projectId') projectId: string,
    @Param('repositoryId') repositoryId: string,
  ) {
    return this.service.pull(projectId, repositoryId);
  }

  @Delete(':repositoryId')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  remove(
    @Param('projectId') projectId: string,
    @Param('repositoryId') repositoryId: string,
  ) {
    return this.service.remove(projectId, repositoryId);
  }
}
