import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PROJECT_ROLES_KEY } from './project-roles.decorator';

@Injectable()
export class ProjectRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const projectId = request.params.projectId;

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this project');
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(PROJECT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const hasRole = requiredRoles.some((role) => role === member.role);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient project role');
    }

    return true;
  }
}
