import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { SprintsService } from './sprints.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';

@Controller('projects/:projectId/sprints')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class SprintsController {
  constructor(private sprintsService: SprintsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.sprintsService.findAll(projectId);
  }

  @Post()
  @RequirePermission('sprints', 'create')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateSprintDto,
  ) {
    return this.sprintsService.create(projectId, dto);
  }

  @Get(':sprintId')
  findOne(@Param('sprintId') sprintId: string) {
    return this.sprintsService.findOne(sprintId);
  }

  @Patch(':sprintId')
  @RequirePermission('sprints', 'update')
  update(
    @Param('sprintId') sprintId: string,
    @Body() dto: UpdateSprintDto,
  ) {
    return this.sprintsService.update(sprintId, dto);
  }

  @Post(':sprintId/activate')
  @RequirePermission('sprints', 'update')
  activate(@Param('sprintId') sprintId: string) {
    return this.sprintsService.activate(sprintId);
  }

  @Post(':sprintId/close')
  @RequirePermission('sprints', 'update')
  closeSprint(@Param('sprintId') sprintId: string) {
    return this.sprintsService.closeSprint(sprintId);
  }

  @Get(':sprintId/stats')
  getSprintStats(@Param('sprintId') sprintId: string) {
    return this.sprintsService.getSprintStats(sprintId);
  }
}
