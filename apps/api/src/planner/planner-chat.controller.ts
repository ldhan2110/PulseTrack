import { Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { PlannerChatService } from './planner-chat.service';

@Controller('planner-sessions')
export class PlannerChatController {
  constructor(private readonly chat: PlannerChatService) {}
  @Post(':sessionId/messages') @UseGuards(JwtAuthGuard) @UseInterceptors(FilesInterceptor('files', 5, { limits: { fileSize: 10 * 1024 * 1024 } }))
  send(@Param('sessionId') sessionId: string, @Body() dto: SendMessageDto, @UploadedFiles() files: Express.Multer.File[] = [], @Req() req: { user: { id: string } }) { return this.chat.submit(sessionId, req.user.id, dto.content ?? '', files); }
  @Get(':sessionId/chat-stream') stream(@Param('sessionId') sessionId: string, @Query('token') token: string, @Res() res: Response) { return this.chat.stream(sessionId, token, res); }
  @Post('proposals/:messageId') @UseGuards(JwtAuthGuard)
  update(@Param('messageId') messageId: string, @Body() dto: UpdateProposalDto, @Req() req: { user: { id: string } }) { return this.chat.updateProposal(messageId, req.user.id, dto); }
  @Post('proposals/:messageId/accept') @UseGuards(JwtAuthGuard)
  accept(@Param('messageId') messageId: string, @Body() dto: UpdateProposalDto, @Req() req: { user: { id: string } }) { return this.chat.acceptProposal(messageId, req.user.id, dto); }
  @Post('proposals/:messageId/dismiss') @UseGuards(JwtAuthGuard)
  dismiss(@Param('messageId') messageId: string, @Req() req: { user: { id: string } }) { return this.chat.dismissProposal(messageId, req.user.id); }
}
