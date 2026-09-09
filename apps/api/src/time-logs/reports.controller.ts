import { Controller, Get, Param, Query, BadRequestException, UseGuards, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TimeLogsService, type GroupBy } from './time-logs.service';
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
    @Query('user') user?: string,
    @Query('ticket') ticket?: string,
    @Query('typeIds') typeIds?: string,
  ) {
    // Parse yyyy-MM-dd as local midnight (not UTC) so the day matches what the client sent
    // regardless of server timezone. Bare `new Date('2026-09-07')` parses as UTC → off-by-one.
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('from and to must be valid ISO dates');
    }
    return this.timeLogsService.getTimesheet(projectId, fromDate, toDate, {
      user,
      ticket,
      typeIds: typeIds ? typeIds.split(',').filter(Boolean) : [],
    });
  }

  @Get('timesheet/export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportTimesheet(
    @Param('projectId') projectId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
    @Query('user') user?: string,
    @Query('ticket') ticket?: string,
    @Query('typeIds') typeIds?: string,
    @Query('groupBy') groupBy?: string,
  ) {
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('from and to must be valid ISO dates');
    }
    const period: GroupBy = groupBy === 'week' || groupBy === 'month' ? groupBy : 'day';
    const buffer = await this.timeLogsService.exportTimesheetExcel(
      projectId,
      fromDate,
      toDate,
      { user, ticket, typeIds: typeIds ? typeIds.split(',').filter(Boolean) : [] },
      period,
    );
    res.set({ 'Content-Disposition': `attachment; filename="report-${from}_${to}.xlsx"` });
    res.end(buffer);
  }
}
