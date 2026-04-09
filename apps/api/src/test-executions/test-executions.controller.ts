import {
  Body, Controller, Delete, Get, Param, Patch, Post,
  Req, Res, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { TestExecutionsService } from './test-executions.service';
import { CreateTestExecutionDto } from './dto/create-test-execution.dto';
import { UpdateResultDto } from './dto/update-result.dto';
import type { TestExecutionStatus } from '@prisma/client';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'test-executions');

@Controller('projects/:projectId/test-executions')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TestExecutionsController {
  constructor(private service: TestExecutionsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.service.findAll(projectId);
  }

  @Get(':executionId')
  findOne(@Param('executionId') executionId: string) {
    return this.service.findOne(executionId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestExecutionDto,
  ) {
    return this.service.create(projectId, dto);
  }

  @Patch(':executionId/status')
  updateStatus(
    @Param('executionId') executionId: string,
    @Body() body: { status: TestExecutionStatus },
  ) {
    return this.service.updateStatus(executionId, body.status);
  }

  @Post(':executionId/cases')
  addCases(
    @Param('executionId') executionId: string,
    @Body() body: { testCaseIds: string[] },
  ) {
    return this.service.addCases(executionId, body.testCaseIds);
  }

  @Delete(':executionId')
  delete(@Param('executionId') executionId: string) {
    return this.service.delete(executionId);
  }

  @Patch('cases/:executionCaseId/result')
  updateResult(
    @Param('executionCaseId') executionCaseId: string,
    @Req() req: any,
    @Body() dto: UpdateResultDto,
  ) {
    return this.service.updateResult(executionCaseId, req.user.id, dto);
  }

  @Post('cases/:executionCaseId/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const caseId = req.params.executionCaseId as string;
          const dir = path.join(UPLOAD_DIR, caseId);
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
  uploadAttachment(
    @Param('executionCaseId') executionCaseId: string,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.createAttachment(executionCaseId, req.user.id, file);
  }

  @Delete('attachments/:attachmentId')
  deleteAttachment(@Param('attachmentId') attachmentId: string) {
    return this.service.deleteAttachment(attachmentId);
  }

  @Get('attachments/:attachmentId/download')
  async downloadAttachment(
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const { filePath, filename, mimeType } = await this.service.getAttachmentFilePath(attachmentId);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', mimeType);
    res.sendFile(filePath);
  }
}
