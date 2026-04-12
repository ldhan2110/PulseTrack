import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreatePrDto } from './dto/create-pr.dto';

@Controller('projects/:projectId/tasks/:taskId/branches')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Get()
  list(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.service.listByTask(projectId, taskId);
  }

  @Post()
  createBranch(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.service.createBranch(projectId, taskId, dto);
  }

  @Post('pr')
  createPr(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePrDto,
  ) {
    return this.service.createPr(projectId, dto);
  }
}
