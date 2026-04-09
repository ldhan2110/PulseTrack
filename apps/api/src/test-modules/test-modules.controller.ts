import {
  Body, Controller, Delete, Get,
  Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { TestModulesService } from './test-modules.service';
import { CreateTestModuleDto } from './dto/create-test-module.dto';
import { UpdateTestModuleDto } from './dto/update-test-module.dto';

@Controller('projects/:projectId/test-modules')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TestModulesController {
  constructor(private service: TestModulesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.service.findAll(projectId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestModuleDto,
  ) {
    return this.service.create(projectId, dto);
  }

  @Patch(':moduleId')
  update(
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateTestModuleDto,
  ) {
    return this.service.update(moduleId, dto);
  }

  @Delete(':moduleId')
  delete(@Param('moduleId') moduleId: string) {
    return this.service.delete(moduleId);
  }
}
