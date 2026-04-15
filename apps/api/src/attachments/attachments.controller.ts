import {
  Controller, Get, Post, Delete, Param, Query, Req, Res,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { AttachmentsService } from './attachments.service';

@Controller('projects/:projectId/tasks/:taskId/attachments')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class AttachmentsController {
  constructor(private attachmentsService: AttachmentsService) {}

  @Get()
  findAll(@Param('taskId') taskId: string) {
    return this.attachmentsService.findAll(taskId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const taskId = req.params.taskId as string;
          const dir = join(process.cwd(), 'uploads', 'tasks', taskId);
          // Ensure directory exists before writing
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
  async upload(
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('inline') inline: string | undefined,
    @Req() req: any,
  ) {
    const isInline = inline === 'true';
    return this.attachmentsService.create(taskId, req.user.id, file, isInline);
  }

  @Get(':attachmentId/download')
  async download(
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const attachment = await this.attachmentsService.findOne(attachmentId);
    const filePath = join(
      process.cwd(), 'uploads', 'tasks', attachment.taskId, attachment.storedName,
    );
    res.download(filePath, attachment.filename);
  }

  @Delete(':attachmentId')
  async remove(
    @Param('attachmentId') attachmentId: string,
    @Req() req: any,
  ) {
    return this.attachmentsService.delete(attachmentId, req.user.id, req.user.permissions);
  }
}
