import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { OpenDirectDto } from './dto/open-direct.dto';

@Controller('projects/:projectId/chat')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversations')
  @RequirePermission('chat', 'view')
  listConversations(@Param('projectId') projectId: string, @Req() req: any) {
    return this.chatService.listConversations(projectId, req.user.id);
  }

  @Post('conversations/direct')
  @RequirePermission('chat', 'view')
  openDirect(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: OpenDirectDto,
  ) {
    return this.chatService.openDirect(projectId, req.user.id, dto.userId);
  }

  @Get('conversations/:id/messages')
  @RequirePermission('chat', 'view')
  getMessages(
    @Param('id') id: string,
    @Req() req: any,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.getMessages(id, req.user.id, cursor);
  }

  @Post('conversations/:id/messages')
  @RequirePermission('chat', 'create')
  sendMessage(@Param('id') id: string, @Req() req: any, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(id, req.user.id, dto.body);
  }

  @Post('conversations/:id/read')
  @RequirePermission('chat', 'view')
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.chatService.markRead(id, req.user.id);
  }
}
