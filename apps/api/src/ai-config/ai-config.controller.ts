import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { AiConfigService } from './ai-config.service';
import { UpsertAiConfigDto } from './dto/upsert-ai-config.dto';
import { UpdateProjectContextDto } from './dto/update-project-context.dto';

@Controller('projects/:projectId/settings/ai')
@UseGuards(JwtAuthGuard)
export class AiConfigController {
  constructor(
    private readonly service: AiConfigService,
  ) {}

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
    @Body() dto: UpsertAiConfigDto,
  ) {
    return this.service.upsert(projectId, dto);
  }

  @Patch('context')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  updateContext(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectContextDto,
  ) {
    return this.service.updateContext(projectId, dto.projectContext);
  }
}
