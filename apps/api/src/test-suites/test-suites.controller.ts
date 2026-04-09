import {
  Body, Controller, Delete, Get,
  Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { TestSuitesService } from './test-suites.service';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto';

@Controller('projects/:projectId/test-suites')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TestSuitesController {
  constructor(private service: TestSuitesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.service.findAll(projectId);
  }

  @Get(':suiteId')
  findOne(@Param('suiteId') suiteId: string) {
    return this.service.findOne(suiteId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestSuiteDto,
  ) {
    return this.service.create(projectId, dto);
  }

  @Patch(':suiteId')
  update(
    @Param('suiteId') suiteId: string,
    @Body() dto: UpdateTestSuiteDto,
  ) {
    return this.service.update(suiteId, dto);
  }

  @Delete(':suiteId')
  delete(@Param('suiteId') suiteId: string) {
    return this.service.delete(suiteId);
  }

  @Post(':suiteId/members')
  addMembers(
    @Param('suiteId') suiteId: string,
    @Body() body: { testCaseIds: string[] },
  ) {
    return this.service.addMembers(suiteId, body.testCaseIds);
  }

  @Delete(':suiteId/members/:testCaseId')
  removeMember(
    @Param('suiteId') suiteId: string,
    @Param('testCaseId') testCaseId: string,
  ) {
    return this.service.removeMember(suiteId, testCaseId);
  }
}
