import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { ProjectRoles } from '../auth/project-roles.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.projectsService.findAllForUser(req.user.id);
  }

  @Get(':projectId')
  @UseGuards(ProjectRolesGuard)
  findOne(@Param('projectId') projectId: string) {
    return this.projectsService.findOne(projectId);
  }

  @Patch(':projectId')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles('pm')
  update(@Param('projectId') projectId: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(projectId, dto);
  }

  @Post(':projectId/archive')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles('pm')
  archive(@Param('projectId') projectId: string) {
    return this.projectsService.archive(projectId);
  }

  @Post(':projectId/unarchive')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles('pm')
  unarchive(@Param('projectId') projectId: string) {
    return this.projectsService.unarchive(projectId);
  }
}
