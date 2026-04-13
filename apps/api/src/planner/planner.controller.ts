// apps/api/src/planner/planner.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { PlannerService } from './planner.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CreateScopeDto } from './dto/create-scope.dto';
import { UpdateScopeDto } from './dto/update-scope.dto';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { ReorderDto } from './dto/reorder.dto';

@Controller()
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class PlannerController {
  constructor(private readonly plannerService: PlannerService) {}

  // ─── Sessions ──────────────────────────────────────────────

  @Get('projects/:projectId/planner-sessions')
  listSessions(@Param('projectId') projectId: string) {
    return this.plannerService.listSessions(projectId);
  }

  @Post('projects/:projectId/planner-sessions')
  createSession(
    @Param('projectId') projectId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return this.plannerService.createSession(projectId, dto);
  }

  @Get('projects/:projectId/planner-sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.plannerService.getSession(sessionId);
  }

  @Patch('projects/:projectId/planner-sessions/:sessionId')
  updateSession(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.plannerService.updateSession(sessionId, dto);
  }

  @Delete('projects/:projectId/planner-sessions/:sessionId')
  deleteSession(@Param('sessionId') sessionId: string) {
    return this.plannerService.deleteSession(sessionId);
  }

  // ─── Messages ──────────────────────────────────────────────

  @Get('planner-sessions/:sessionId/messages')
  listMessages(
    @Param('sessionId') sessionId: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.plannerService.listMessages(
      sessionId,
      take ? parseInt(take, 10) : 50,
      skip ? parseInt(skip, 10) : 0,
    );
  }

  // ─── Scopes ────────────────────────────────────────────────

  @Get('planner-sessions/:sessionId/scopes')
  listScopes(@Param('sessionId') sessionId: string) {
    return this.plannerService.listScopes(sessionId);
  }

  @Post('planner-sessions/:sessionId/scopes')
  createScope(
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateScopeDto,
  ) {
    return this.plannerService.createScope(sessionId, dto);
  }

  @Patch('planner-sessions/:sessionId/scopes/:scopeId')
  updateScope(
    @Param('scopeId') scopeId: string,
    @Body() dto: UpdateScopeDto,
  ) {
    return this.plannerService.updateScope(scopeId, dto);
  }

  @Delete('planner-sessions/:sessionId/scopes/:scopeId')
  deleteScope(@Param('scopeId') scopeId: string) {
    return this.plannerService.deleteScope(scopeId);
  }

  @Patch('planner-sessions/:sessionId/scopes/reorder')
  reorderScopes(
    @Param('sessionId') sessionId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.plannerService.reorderScopes(sessionId, dto);
  }

  // ─── Features ──────────────────────────────────────────────

  @Post('planner-sessions/:sessionId/scopes/:scopeId/features')
  createFeature(
    @Param('scopeId') scopeId: string,
    @Body() dto: CreateFeatureDto,
  ) {
    return this.plannerService.createFeature(scopeId, dto);
  }

  @Patch('planner-sessions/:sessionId/scopes/:scopeId/features/:featureId')
  updateFeature(
    @Param('featureId') featureId: string,
    @Body() dto: UpdateFeatureDto,
  ) {
    return this.plannerService.updateFeature(featureId, dto);
  }

  @Delete('planner-sessions/:sessionId/scopes/:scopeId/features/:featureId')
  deleteFeature(@Param('featureId') featureId: string) {
    return this.plannerService.deleteFeature(featureId);
  }

  @Patch('planner-sessions/:sessionId/scopes/:scopeId/features/reorder')
  reorderFeatures(
    @Param('scopeId') scopeId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.plannerService.reorderFeatures(scopeId, dto);
  }
}
