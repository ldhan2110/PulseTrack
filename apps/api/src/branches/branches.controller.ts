import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreatePrDto } from './dto/create-pr.dto';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Get('remote-branches')
  listRemoteBranches(
    @Param('projectId') projectId: string,
    @Query('repositoryId') repositoryId: string,
  ) {
    return this.service.listRemoteBranches(projectId, repositoryId);
  }

  @Get('tasks/:taskId/branches')
  list(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.service.listByTask(projectId, taskId);
  }

  @Post('tasks/:taskId/branches')
  createBranch(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.service.createBranch(projectId, taskId, dto);
  }

  @Post('tasks/:taskId/branches/pr')
  createPr(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePrDto,
  ) {
    return this.service.createPr(projectId, dto);
  }

  @Delete('tasks/:taskId/branches/:branchId')
  deleteBranch(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('branchId') branchId: string,
  ) {
    return this.service.deleteTaskBranch(projectId, taskId, branchId);
  }
}
