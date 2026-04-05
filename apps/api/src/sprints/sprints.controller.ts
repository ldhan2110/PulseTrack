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
import { ProjectRoles } from '../auth/project-roles.decorator';
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
  @ProjectRoles('pm')
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
  @ProjectRoles('pm')
  update(
    @Param('sprintId') sprintId: string,
    @Body() dto: UpdateSprintDto,
  ) {
    return this.sprintsService.update(sprintId, dto);
  }

  @Post(':sprintId/activate')
  @ProjectRoles('pm')
  activate(@Param('sprintId') sprintId: string) {
    return this.sprintsService.activate(sprintId);
  }

  @Post(':sprintId/close')
  @ProjectRoles('pm')
  closeSprint(@Param('sprintId') sprintId: string) {
    return this.sprintsService.closeSprint(sprintId);
  }

  @Get(':sprintId/stats')
  getSprintStats(@Param('sprintId') sprintId: string) {
    return this.sprintsService.getSprintStats(sprintId);
  }
}
