import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { McpTokenService } from './mcp-token.service';
import { CreateMcpTokenDto } from './dto/create-mcp-token.dto';

@Controller('projects/:projectId/mcp-tokens')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class McpTokenController {
  constructor(private readonly service: McpTokenService) {}

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.service.list(projectId);
  }

  @Post()
  @RequirePermission('projectSettings', 'update')
  create(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: CreateMcpTokenDto,
  ) {
    return this.service.createToken(projectId, req.user.id, dto);
  }

  @Delete(':id')
  @RequirePermission('projectSettings', 'update')
  revoke(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.service.revoke(projectId, id);
  }
}
