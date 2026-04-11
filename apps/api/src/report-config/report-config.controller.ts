import { Controller, Get, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ReportConfigService } from './report-config.service';
import { UpsertReportConfigDto } from './dto/upsert-report-config.dto';

@Controller('projects/:projectId/settings/report')
@UseGuards(JwtAuthGuard)
export class ReportConfigController {
  constructor(private readonly service: ReportConfigService) {}

  @Get()
  @UseGuards(ProjectRolesGuard)
  findOne(@Param('projectId') projectId: string) {
    return this.service.findByProjectId(projectId);
  }

  @Put()
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  upsert(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertReportConfigDto,
  ) {
    return this.service.upsert(projectId, dto);
  }

  @Post('test')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  testReport(@Param('projectId') projectId: string) {
    return this.service.testReport(projectId);
  }

  @Get('server-timezone')
  @UseGuards(ProjectRolesGuard)
  getServerTimezone() {
    return this.service.getServerTimezone();
  }
}
