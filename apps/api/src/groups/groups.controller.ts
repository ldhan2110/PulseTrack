import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { SetGroupMembersDto } from './dto/set-group-members.dto';

@Controller('projects/:projectId/groups')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Get()
  @RequirePermission('projectSettings', 'view')
  findAll(@Param('projectId') projectId: string) {
    return this.groupsService.findAll(projectId);
  }

  @Post()
  @RequirePermission('projectSettings', 'update')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupsService.create(projectId, dto);
  }

  @Patch(':groupId')
  @RequirePermission('projectSettings', 'update')
  update(
    @Param('projectId') projectId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(projectId, groupId, dto);
  }

  @Delete(':groupId')
  @RequirePermission('projectSettings', 'update')
  remove(
    @Param('projectId') projectId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.remove(projectId, groupId);
  }

  @Put(':groupId/members')
  @RequirePermission('projectSettings', 'update')
  setMembers(
    @Param('projectId') projectId: string,
    @Param('groupId') groupId: string,
    @Body() dto: SetGroupMembersDto,
  ) {
    return this.groupsService.setMembers(projectId, groupId, dto);
  }
}
