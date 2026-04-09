import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { MembersService } from './members.service';
import { AddMemberDto } from './dto/add-member.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { ChangeRoleDto } from './dto/change-role.dto';

@Controller('projects/:projectId/members')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class MembersController {
  constructor(private membersService: MembersService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.membersService.findAll(projectId);
  }

  @Get('search')
  searchUsers(
    @Param('projectId') projectId: string,
    @Query('q') query: string,
  ) {
    return this.membersService.searchUsers(projectId, query ?? '');
  }

  @Post()
  @RequirePermission('members', 'create')
  addMember(
    @Param('projectId') projectId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.membersService.addMember(projectId, dto);
  }

  @Post('batch')
  @RequirePermission('members', 'create')
  addMembers(
    @Param('projectId') projectId: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.membersService.addMembers(projectId, dto);
  }

  @Patch(':memberId/role')
  @RequirePermission('members', 'update')
  changeMemberRole(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.membersService.changeMemberRole(projectId, memberId, dto);
  }

  @Get(':memberId/active-work')
  @RequirePermission('members', 'view')
  getActiveWork(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.membersService.getActiveWork(projectId, memberId);
  }

  @Delete(':memberId')
  @RequirePermission('members', 'delete')
  removeMember(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.membersService.removeMember(projectId, memberId, req.user.id);
  }
}
