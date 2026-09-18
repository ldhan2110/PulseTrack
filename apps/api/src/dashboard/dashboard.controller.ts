import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { DashboardService } from './dashboard.service';

@Controller('projects/:projectId/dashboard')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  getProjectDashboard(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Query('timeFilter') timeFilter?: 'sprint' | '7d' | '30d',
  ) {
    return this.dashboardService.getProjectDashboard(projectId, req.user.id, timeFilter);
  }
}
