import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { SkillsService } from './skills.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Controller('projects/:projectId/settings/skills')
@UseGuards(JwtAuthGuard)
export class SkillsController {
  constructor(private readonly service: SkillsService) {}

  @Get()
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  list(@Param('projectId') projectId: string) {
    return this.service.list(projectId);
  }

  @Post()
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  create(@Param('projectId') projectId: string, @Body() dto: CreateSkillDto) {
    return this.service.create(projectId, dto);
  }

  @Put(':skillId')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  update(
    @Param('projectId') projectId: string,
    @Param('skillId') skillId: string,
    @Body() dto: UpdateSkillDto,
  ) {
    return this.service.update(projectId, skillId, dto);
  }

  @Delete(':skillId')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  remove(
    @Param('projectId') projectId: string,
    @Param('skillId') skillId: string,
  ) {
    return this.service.remove(projectId, skillId);
  }
}
