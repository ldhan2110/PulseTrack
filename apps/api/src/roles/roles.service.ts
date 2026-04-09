import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string) {
    return this.prisma.customRole.findMany({
      where: { projectId },
      include: { _count: { select: { members: true } } },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(projectId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.customRole.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Role "${dto.name}" already exists`);
    }

    return this.prisma.customRole.create({
      data: {
        projectId,
        name: dto.name,
        permissions: dto.permissions,
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async update(projectId: string, roleId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.customRole.findFirst({
      where: { id: roleId, projectId },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ForbiddenException('Cannot edit the system PM role');

    // If setting as default, unset current default
    if (dto.isDefault === true) {
      await this.prisma.customRole.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check name uniqueness if changing name
    if (dto.name && dto.name !== role.name) {
      const nameExists = await this.prisma.customRole.findUnique({
        where: { projectId_name: { projectId, name: dto.name } },
      });
      if (nameExists) {
        throw new ConflictException(`Role "${dto.name}" already exists`);
      }
    }

    return this.prisma.customRole.update({
      where: { id: roleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async delete(projectId: string, roleId: string) {
    const role = await this.prisma.customRole.findFirst({
      where: { id: roleId, projectId },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ForbiddenException('Cannot delete the system PM role');
    if (role.isDefault) throw new BadRequestException('Cannot delete the default role. Set another role as default first.');

    const defaultRole = await this.prisma.customRole.findFirst({
      where: { projectId, isDefault: true },
    });
    if (!defaultRole) throw new BadRequestException('No default role found');

    // Move members to default role, then delete
    await this.prisma.$transaction([
      this.prisma.projectMember.updateMany({
        where: { roleId },
        data: { roleId: defaultRole.id },
      }),
      this.prisma.customRole.delete({ where: { id: roleId } }),
    ]);

    return { deleted: true, membersReassigned: true, newRoleId: defaultRole.id };
  }
}
