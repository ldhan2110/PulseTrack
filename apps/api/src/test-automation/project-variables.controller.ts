import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectVariablesService } from './project-variables.service';
import {
  CreateProjectVariableDto,
  UpdateProjectVariableDto,
} from './dto/create-project-variable.dto';

@Controller('projects/:projectId/variables')
@UseGuards(JwtAuthGuard)
export class ProjectVariablesController {
  constructor(private readonly service: ProjectVariablesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.service.findAll(projectId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectVariableDto,
  ) {
    return this.service.create(projectId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectVariableDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
