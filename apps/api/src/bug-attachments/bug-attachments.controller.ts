import {
  Controller, Delete, Get, Param, Post, Query, Req, Res,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { BugAttachmentsService } from './bug-attachments.service';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'bugs');

@Controller('projects/:projectId/bugs/:bugId/attachments')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class BugAttachmentsController {
  constructor(private service: BugAttachmentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const bugId = req.params.bugId as string;
          const dir = path.join(UPLOAD_DIR, bugId);
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(
    @Param('bugId') bugId: string,
    @Query('inline') inline: string | undefined,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const isInline = inline === 'true';
    return this.service.create(bugId, req.user.id, file, isInline);
  }

  @Get()
  findAll(@Param('bugId') bugId: string) {
    return this.service.findAll(bugId);
  }

  @Delete(':attachmentId')
  delete(
    @Param('attachmentId') attachmentId: string,
    @Req() req: any,
  ) {
    return this.service.delete(attachmentId, req.user.id, req.user.permissions);
  }

  @Get(':attachmentId/download')
  async download(
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const { filePath, filename, mimeType } = await this.service.getFilePath(attachmentId);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', mimeType);
    res.sendFile(filePath);
  }
}
