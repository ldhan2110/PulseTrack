import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PlannerAiConfigService } from './planner-ai-config.service';
import { UpsertPlannerAiConfigDto } from './dto/upsert-planner-ai-config.dto';

@Controller('projects/:projectId/settings/planner-ai')
@UseGuards(JwtAuthGuard)
export class PlannerAiConfigController {
  constructor(private readonly service: PlannerAiConfigService) {}

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
    @Body() dto: UpsertPlannerAiConfigDto,
  ) {
    return this.service.upsert(projectId, dto);
  }
}
