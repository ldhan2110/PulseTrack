import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_KEY, RequiredPermission } from './require-permission.decorator';
import { hasPermission, SYSTEM_ROLE_PERMISSIONS } from './permissions';
import type { RolePermissions } from './permissions';

@Injectable()
export class ProjectRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  // Nested routes omit :projectId (e.g. wbs/tasks/:taskId/*,
  // planner-sessions/:sessionId/*). Resolve the owning project from the parent
  // entity so those routes cannot bypass the permission check.
  // ponytail: new project-less nested params must be registered here.
  private async resolveFromParent(params: Record<string, string>): Promise<string | null> {
    if (params.phaseId) {
      const p = await this.prisma.wbsPhase.findUnique({
        where: { id: params.phaseId },
        select: { projectId: true },
      });
      return p?.projectId ?? null;
    }
    if (params.taskId) {
      const t = await this.prisma.wbsTask.findUnique({
        where: { id: params.taskId },
        select: { phase: { select: { projectId: true } } },
      });
      return t?.phase.projectId ?? null;
    }
    if (params.sessionId) {
      const s = await this.prisma.plannerSession.findUnique({
        where: { id: params.sessionId },
        select: { projectId: true },
      });
      return s?.projectId ?? null;
    }
    return null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const projectId = request.params.projectId ?? (await this.resolveFromParent(request.params));

    // Truly project-less route (e.g. /users) — skip to JWT-only auth.
    if (!projectId) return true;

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
      include: { customRole: true },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this project');
    }

    const role = member.customRole;
    const permissions: RolePermissions = role.isSystem
      ? SYSTEM_ROLE_PERMISSIONS
      : (role.permissions as unknown as RolePermissions);

    // Attach to request for downstream use
    request.user.permissions = permissions;
    request.user.isSystemRole = role.isSystem;

    const required = this.reflector.getAllAndOverride<RequiredPermission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No decorator = membership check only
    if (!required) return true;

    if (role.isSystem) return true;

    if (!hasPermission(permissions, required.area, required.action)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
