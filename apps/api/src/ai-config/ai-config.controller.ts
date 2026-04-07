import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { ProjectRoles } from '../auth/project-roles.decorator';
import { AiConfigService } from './ai-config.service';
import { AiContextGeneratorService } from './ai-context-generator.service';
import { UpsertAiConfigDto } from './dto/upsert-ai-config.dto';
import { UpdateProjectContextDto } from './dto/update-project-context.dto';

@Controller('projects/:projectId/settings/ai')
@UseGuards(JwtAuthGuard)
export class AiConfigController {
  constructor(
    private readonly service: AiConfigService,
    private readonly contextGenerator: AiContextGeneratorService,
  ) {}

  @Get()
  @UseGuards(ProjectRolesGuard)
  findOne(@Param('projectId') projectId: string) {
    return this.service.findByProjectId(projectId);
  }

  @Put()
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles('pm')
  upsert(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertAiConfigDto,
  ) {
    return this.service.upsert(projectId, dto);
  }

  @Patch('context')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles('pm')
  updateContext(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectContextDto,
  ) {
    return this.service.updateContext(projectId, dto.projectContext);
  }

  @Post('context/generate')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles('pm')
  generateContext(@Param('projectId') projectId: string) {
    return this.contextGenerator.generate(projectId);
  }
}
