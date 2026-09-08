import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { SetGroupMembersDto } from './dto/set-group-members.dto';

const memberInclude = {
  members: {
    include: {
      user: {
        select: { id: true, email: true, username: true, name: true, imageUrl: true },
      },
    },
  },
} satisfies Prisma.GroupInclude;

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  findAll(projectId: string) {
    return this.prisma.group.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: memberInclude,
    });
  }

  async create(projectId: string, dto: CreateGroupDto) {
    try {
      return await this.prisma.group.create({
        data: { projectId, name: dto.name, description: dto.description },
        include: memberInclude,
      });
    } catch (e) {
      throw this.rethrowDuplicate(e);
    }
  }

  async update(projectId: string, groupId: string, dto: UpdateGroupDto) {
    await this.getGroupOrThrow(projectId, groupId);
    try {
      return await this.prisma.group.update({
        where: { id: groupId },
        data: { name: dto.name, description: dto.description },
        include: memberInclude,
      });
    } catch (e) {
      throw this.rethrowDuplicate(e);
    }
  }

  async remove(projectId: string, groupId: string) {
    await this.getGroupOrThrow(projectId, groupId);
    await this.prisma.group.delete({ where: { id: groupId } });
    return { id: groupId };
  }

  async setMembers(projectId: string, groupId: string, dto: SetGroupMembersDto) {
    await this.getGroupOrThrow(projectId, groupId);

    const ids = [...new Set(dto.memberIds)];
    if (ids.length > 0) {
      const valid = await this.prisma.projectMember.count({
        where: { projectId, id: { in: ids } },
      });
      if (valid !== ids.length) {
        throw new BadRequestException(
          'One or more members do not belong to this project',
        );
      }
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: { members: { set: ids.map((id) => ({ id })) } },
      include: memberInclude,
    });
  }

  private async getGroupOrThrow(projectId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, projectId },
    });
    if (!group) {
      throw new NotFoundException('Group not found in this project');
    }
    return group;
  }

  private rethrowDuplicate(e: unknown) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictException('A group with this name already exists');
    }
    return e;
  }
}
