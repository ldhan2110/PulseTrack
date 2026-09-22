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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ConversationMemberGuard } from './conversation-member.guard';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ReactMessageDto } from './dto/react-message.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  create(@Req() req: any, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(req.user.id, dto);
  }

  @Get('conversations')
  listMine(@Req() req: any) {
    return this.chatService.listMyConversations(req.user.id);
  }

  @Get('search-targets')
  searchTargets(@Req() req: any, @Query('q') q?: string) {
    return this.chatService.searchTargets(req.user.id, q ?? '');
  }

  @Post('conversations/:id/messages')
  @UseGuards(ConversationMemberGuard)
  send(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(id, req.user.id, dto.body, dto.clientTempId);
  }

  @Get('conversations/:id/messages')
  @UseGuards(ConversationMemberGuard)
  history(@Param('id') id: string, @Query('cursor') cursor?: string) {
    return this.chatService.getMessages(id, cursor);
  }

  @Post('conversations/:id/members')
  @UseGuards(ConversationMemberGuard)
  addMembers(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.chatService.addMembers(id, req.user.id, dto.userIds);
  }

  @Delete('conversations/:id/members/:userId')
  @UseGuards(ConversationMemberGuard)
  removeMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.chatService.removeMember(id, req.user.id, userId);
  }

  @Delete('conversations/:id')
  @UseGuards(ConversationMemberGuard)
  leave(@Req() req: any, @Param('id') id: string) {
    return this.chatService.leaveConversation(id, req.user.id);
  }

  @Post('conversations/:id/read')
  @UseGuards(ConversationMemberGuard)
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.chatService.markRead(id, req.user.id);
  }

  @Patch('messages/:id')
  edit(@Req() req: any, @Param('id') id: string, @Body() dto: EditMessageDto) {
    return this.chatService.editMessage(id, req.user.id, dto.body);
  }

  @Delete('messages/:id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.chatService.deleteMessage(id, req.user.id);
  }

  @Post('messages/:id/reactions')
  react(@Req() req: any, @Param('id') id: string, @Body() dto: ReactMessageDto) {
    return this.chatService.toggleReaction(id, req.user.id, dto.emoji);
  }

  @Post('conversations/:id/attachments')
  @UseGuards(ConversationMemberGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const conversationId = req.params.id as string;
          const dir = join(process.cwd(), 'uploads', 'chat', conversationId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.chatService.createAttachmentMessage(
      id,
      req.user.id,
      file,
      req.body?.body,
    );
  }

  @Get('attachments/:id/download')
  async download(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const att = await this.chatService.getAttachmentForDownload(
      id,
      req.user.id,
    );
    const filePath = join(
      process.cwd(),
      'uploads',
      'chat',
      att.conversationId,
      att.storedName,
    );
    res.download(filePath, att.filename);
  }
}
