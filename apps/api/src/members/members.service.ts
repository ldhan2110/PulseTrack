import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { ChangeRoleDto } from './dto/change-role.dto';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.projectMember.create({
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
