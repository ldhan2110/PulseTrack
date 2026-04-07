import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { ProjectRoles } from '../auth/project-roles.decorator';
import { WorkflowService } from './workflow.service';
import { SaveWorkflowDto } from './dto/save-workflow.dto';

@Controller('projects/:projectId/workflow')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WorkflowController {
  constructor(private workflowService: WorkflowService) {}

  @Get()
  getWorkflow(@Param('projectId') projectId: string) {
    return this.workflowService.getWorkflow(projectId);
  }

  @Put()
  @ProjectRoles('pm')
  saveWorkflow(
    @Param('projectId') projectId: string,
    @Body() dto: SaveWorkflowDto,
  ) {
    return this.workflowService.saveWorkflow(projectId, dto);
  }

  @Get('statuses/:statusId/allowed-assignees')
  getAllowedAssignees(
    @Param('projectId') projectId: string,
    @Param('statusId') statusId: string,
  ) {
    return this.workflowService.getAllowedAssignees(projectId, statusId);
  }
}
