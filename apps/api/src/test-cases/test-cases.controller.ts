import {
  Body, Controller, Delete, Get,
  Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { TestCasesService } from './test-cases.service';
import { CreateTestCaseDto } from './dto/create-test-case.dto';
import { UpdateTestCaseDto } from './dto/update-test-case.dto';

@Controller('projects/:projectId/test-cases')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TestCasesController {
  constructor(private service: TestCasesService) {}

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query('moduleId') moduleId?: string,
    @Query('suiteId') suiteId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('tags') tags?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(projectId, {
      moduleId, suiteId, status, priority, tags, search,
    });
  }

  @Get(':testCaseId')
  findOne(@Param('testCaseId') testCaseId: string) {
    return this.service.findOne(testCaseId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: CreateTestCaseDto,
  ) {
    return this.service.create(projectId, req.user.id, dto);
  }

  @Patch(':testCaseId')
  update(
    @Param('testCaseId') testCaseId: string,
    @Body() dto: UpdateTestCaseDto,
  ) {
    return this.service.update(testCaseId, dto);
  }

  @Delete(':testCaseId')
  delete(@Param('testCaseId') testCaseId: string) {
    return this.service.delete(testCaseId);
  }

  @Post('bulk-suite')
  bulkAddToSuite(
    @Body() body: { suiteId: string; testCaseIds: string[] },
  ) {
    return this.service.bulkAddToSuite(body.suiteId, body.testCaseIds);
  }
}
