import {
  Controller, Get, Post, Delete, Patch, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('projects/:projectId/tasks/:taskId/comments')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get()
  findAll(@Param('taskId') taskId: string) {
    return this.commentsService.findAll(taskId);
  }

  @Post()
  create(
    @Param('taskId') taskId: string,
    @Req() req: any,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(taskId, req.user.id, dto.content);
  }

  @Post(':commentId/replies')
  createReply(
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Req() req: any,
    @Body() dto: CreateReplyDto,
  ) {
    return this.commentsService.createReply(taskId, commentId, req.user.id, dto.content);
  }

  @Patch(':commentId')
  update(
    @Param('commentId') commentId: string,
    @Req() req: any,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(commentId, req.user.id, req.user.projectRole, dto.content);
  }

  @Delete(':commentId')
  remove(
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    return this.commentsService.delete(commentId, req.user.id, req.user.projectRole);
  }
}
