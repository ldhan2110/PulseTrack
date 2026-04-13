import {
  Controller, Post, Param, Body, Query, Sse, UseGuards,
  UseInterceptors, UploadedFiles, MessageEvent,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { Observable, map } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { PlannerChatService } from './planner-chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('planner-sessions/:sessionId')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class PlannerChatController {
  constructor(private readonly chatService: PlannerChatService) {}

  @Post('messages')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const sessionId = req.params.sessionId as string;
          const dir = join(process.cwd(), 'uploads', 'planner', sessionId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.chatService.sendMessage(sessionId, dto.content, files ?? []);
  }

  @Sse('chat-stream')
  chatStream(
    @Param('sessionId') sessionId: string,
    @Query('token') token: string,
  ): Observable<MessageEvent> {
    const subject = this.chatService.getStream(token);
    return subject.pipe(
      map((event) => ({
        type: event.type,
        data: JSON.stringify(event.data),
      })),
    );
  }
}
