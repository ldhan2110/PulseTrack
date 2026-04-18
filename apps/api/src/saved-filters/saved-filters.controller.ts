import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { SavedFiltersService } from './saved-filters.service';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { UpdateSavedFilterDto } from './dto/update-saved-filter.dto';

@Controller('projects/:projectId/saved-filters')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class SavedFiltersController {
  constructor(private savedFiltersService: SavedFiltersService) {}

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query('entityType') entityType: string | undefined,
    @Req() req: any,
  ) {
    return this.savedFiltersService.findAll(projectId, req.user.id, entityType);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateSavedFilterDto,
    @Req() req: any,
  ) {
    return this.savedFiltersService.create(projectId, req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSavedFilterDto,
    @Req() req: any,
  ) {
    return this.savedFiltersService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.savedFiltersService.remove(id, req.user.id);
  }
}
