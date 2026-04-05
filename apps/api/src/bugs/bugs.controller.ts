import {
  Body,
  Controller,
  Delete,
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
import { BugsService } from './bugs.service';
import { CreateBugDto } from './dto/create-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';

@Controller('projects/:projectId/bugs')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class BugsController {
  constructor(private bugsService: BugsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.bugsService.findAll(projectId);
  }

  @Post()
  @ProjectRoles('pm', 'ba', 'qc')
  create(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: CreateBugDto,
  ) {
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
