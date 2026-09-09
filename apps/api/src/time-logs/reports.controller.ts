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
    // Parse yyyy-MM-dd as local midnight (not UTC) so the day matches what the client sent
    // regardless of server timezone. Bare `new Date('2026-09-07')` parses as UTC → off-by-one.
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('from and to must be valid ISO dates');
    }
    return this.timeLogsService.getTimesheet(projectId, fromDate, toDate);
  }
}
