import { Controller, Get, Param, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { TimeLogsService } from './time-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';

@Controller('projects/:projectId/reports')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class ReportsController {
  constructor(private readonly timeLogsService: TimeLogsService) {}

  @Get('timesheet')
  getTimesheet(
    @Param('projectId') projectId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('from and to must be valid ISO dates');
    }
    return this.timeLogsService.getTimesheet(projectId, fromDate, toDate);
  }
}
