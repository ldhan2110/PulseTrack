import {
  Body, Controller, Delete, Get,
  Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('projects/:projectId/roles')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.rolesService.findAll(projectId);
  }

  @Post()
  @RequirePermission('members', 'create')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.create(projectId, dto);
  }

  @Patch(':roleId')
  @RequirePermission('members', 'update')
  update(
    @Param('projectId') projectId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(projectId, roleId, dto);
  }

  @Delete(':roleId')
  @RequirePermission('members', 'delete')
  delete(
    @Param('projectId') projectId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rolesService.delete(projectId, roleId);
  }
}
