import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { WikiService } from './wiki.service';

@Controller('projects/:projectId/wiki')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WikiController {
  constructor(
    private readonly service: WikiService,
  ) {}

  @Get('pages')
  getPageTree(@Param('projectId') projectId: string) {
    return this.service.getPageTree(projectId);
  }

  @Get('pages/*pagePath')
  getPage(@Param('projectId') projectId: string, @Param('pagePath') pagePath: string | string[]) {
    const resolved = Array.isArray(pagePath) ? pagePath.join('/') : pagePath;
    return this.service.getPage(projectId, resolved);
  }

  @Get('search')
  search(@Param('projectId') projectId: string, @Query('q') query: string) {
    return this.service.searchPages(projectId, query || '');
  }

  @Get('annotations')
  getAnnotations(
    @Param('projectId') projectId: string,
    @Query('pagePath') pagePath: string,
  ) {
    return this.service.getAnnotations(projectId, pagePath);
  }

  @Post('annotations')
  createAnnotation(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() body: { pagePath: string; sectionRef?: string; content: string },
  ) {
    return this.service.createAnnotation(projectId, req.user.id, body);
  }

  @Put('annotations/:annotationId')
  updateAnnotation(
    @Param('annotationId') annotationId: string,
    @Req() req: any,
    @Body() body: { content: string },
  ) {
    return this.service.updateAnnotation(annotationId, req.user.id, body.content);
  }

  @Delete('annotations/:annotationId')
  deleteAnnotation(
    @Param('annotationId') annotationId: string,
    @Req() req: any,
  ) {
    return this.service.deleteAnnotation(annotationId, req.user.id);
  }

  @Get('qa/history')
  getQaHistory(@Param('projectId') projectId: string) {
    return this.service.getQaHistory(projectId);
  }

  @Delete('qa/:qaId')
  deleteQa(@Param('projectId') projectId: string, @Param('qaId') qaId: string) {
    return this.service.deleteQa(projectId, qaId);
  }
}
