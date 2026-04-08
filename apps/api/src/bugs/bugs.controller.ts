import {
  Body, Controller, Delete, ForbiddenException, Get,
  Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { ProjectRoles } from '../auth/project-roles.decorator';
import { BugsService } from './bugs.service';
import { CreateBugDto } from './dto/create-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('projects/:projectId/bugs')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class BugsController {
  constructor(
    private bugsService: BugsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query('severity') severity?: string,
    @Query('workflowStatusId') workflowStatusId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('parentTaskId') parentTaskId?: string,
    @Query('reporterId') reporterId?: string,
    @Query('search') search?: string,
  ) {
    return this.bugsService.findAll(projectId, {
      severity, workflowStatusId, assigneeId, parentTaskId, reporterId, search,
    });
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: CreateBugDto,
  ) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { bugReporterRoles: true },
    });
    const member = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: req.user.id },
      select: { role: true },
    });
    if (!member || !project.bugReporterRoles.includes(member.role)) {
      throw new ForbiddenException('Your role is not allowed to report bugs in this project');
    }
    return this.bugsService.create(projectId, req.user.id, dto);
  }

  @Get(':bugId')
  findOne(@Param('bugId') bugId: string) {
    return this.bugsService.findOne(bugId);
  }

  @Patch(':bugId')
  @ProjectRoles('pm', 'qc')
  update(@Param('bugId') bugId: string, @Body() dto: UpdateBugDto) {
    return this.bugsService.update(bugId, dto);
  }

  @Delete(':bugId')
  @ProjectRoles('pm')
  delete(@Param('bugId') bugId: string) {
    return this.bugsService.delete(bugId);
  }
}
