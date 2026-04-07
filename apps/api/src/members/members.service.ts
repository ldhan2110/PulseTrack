import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AddMemberDto } from './dto/add-member.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { ChangeRoleDto } from './dto/change-role.dto';

@Injectable()
export class MembersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(projectId: string) {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, email: true, username: true },
        },
      },
    });
  }

  async addMember(projectId: string, dto: AddMemberDto) {
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this project');
    }

    const member = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        role: dto.role,
      },
      include: {
        user: {
          select: { id: true, email: true, username: true },
        },
      },
    });

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    this.notifications.notifyUser(dto.userId, 'member:added', {
      projectId,
      projectName: project?.name ?? '',
    });

    return member;
  }

  async addMembers(projectId: string, dto: AddMembersDto) {
    const userIds = dto.members.map((m) => m.userId);
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length !== userIds.length) {
      throw new BadRequestException('Duplicate user IDs in request');
    }
    const existing = await this.prisma.projectMember.findMany({
      where: { projectId, userId: { in: userIds } },
      select: { userId: true },
    });

    if (existing.length > 0) {
      const existingIds = existing.map((m) => m.userId);
      throw new ConflictException(
        `Some users are already members of this project: ${existingIds.join(', ')}`,
      );
    }

    const members = await this.prisma.$transaction(
      dto.members.map((entry) =>
        this.prisma.projectMember.create({
          data: {
            projectId,
            userId: entry.userId,
            role: entry.role,
          },
          include: {
            user: {
              select: { id: true, email: true, username: true },
            },
          },
        }),
      ),
    );

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    for (const m of members) {
      this.notifications.notifyUser(m.userId, 'member:added', {
        projectId,
        projectName: project?.name ?? '',
      });
    }

    return members;
  }

  async changeMemberRole(
    projectId: string,
    memberId: string,
    dto: ChangeRoleDto,
  ) {
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    return this.prisma.projectMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: {
          select: { id: true, email: true, username: true },
        },
      },
    });
  }

  async removeMember(projectId: string, memberId: string) {
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    // Prevent removing the last PM
    if (member.role === 'pm') {
      const pmCount = await this.prisma.projectMember.count({
        where: { projectId, role: 'pm' },
      });

      if (pmCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last PM from a project',
        );
      }
    }

    await this.prisma.projectMember.delete({ where: { id: memberId } });

    this.notifications.notifyUser(member.userId, 'member:removed', { projectId });
  }

  async searchUsers(projectId: string, query: string) {
    const existing = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    const excludedIds = existing.map((m) => m.userId);

    return this.prisma.user.findMany({
      where: {
        ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}),
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true, username: true },
      take: 20,
    });
  }
}
