import {
  Controller, Get, Post, Delete, Patch, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('projects/:projectId/bugs/:bugId/comments')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class BugCommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get()
  findAll(@Param('bugId') bugId: string) {
    return this.commentsService.findAllForBug(bugId);
  }

  @Post()
  create(
    @Param('bugId') bugId: string,
    @Req() req: any,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createForBug(bugId, req.user.id, dto.content);
  }

  @Post(':commentId/replies')
  createReply(
    @Param('bugId') bugId: string,
    @Param('commentId') commentId: string,
    @Req() req: any,
    @Body() dto: CreateReplyDto,
  ) {
    return this.commentsService.createReplyForBug(bugId, commentId, req.user.id, dto.content);
  }

  @Patch(':commentId')
  update(
    @Param('commentId') commentId: string,
    @Req() req: any,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(commentId, req.user.id, req.user.permissions, dto.content);
  }

  @Delete(':commentId')
  remove(
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    return this.commentsService.delete(commentId, req.user.id, req.user.permissions);
  }

  @Post(':commentId/likes')
  toggleLike(
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    return this.commentsService.toggleLike(commentId, req.user.id);
  }
}
