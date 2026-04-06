import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          prefix: dto.prefix,
          ownerId: userId,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId,
          role: 'pm',
        },
      });

      return project;
    });
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            _count: {
              select: { tasks: true },
            },
            tasks: {
              select: { status: true },
              where: {
                status: { in: ['IN_PROGRESS', 'BLOCKED'] },
              },
            },
          },
        },
      },
    });

    return memberships
      .filter((m) => !m.project.archived)
      .map((m) => {
        const inProgressCount = m.project.tasks.filter(
          (t) => t.status === 'IN_PROGRESS',
        ).length;
        const blockedCount = m.project.tasks.filter(
          (t) => t.status === 'BLOCKED',
        ).length;

        return {
          id: m.project.id,
          name: m.project.name,
          description: m.project.description,
          prefix: m.project.prefix,
          avatarUrl: m.project.avatarUrl,
          archived: m.project.archived,
          createdAt: m.project.createdAt,
          userRole: m.role,
          taskSummary: {
            total: m.project._count.tasks,
            inProgress: inProgressCount,
            blocked: blockedCount,
          },
        };
      });
  }

  async findOne(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, username: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return project;
  }

  async update(projectId: string, dto: UpdateProjectDto) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async archive(projectId: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { archived: true },
    });
  }

  async unarchive(projectId: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { archived: false },
    });
  }

  async findByPrefix(prefix: string) {
    const project = await this.prisma.project.findUnique({
      where: { prefix },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, username: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with prefix ${prefix} not found`);
    }

    return project;
  }

  async updateSettings(projectId: string, dto: UpdateSettingsDto) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.prefix !== undefined && { prefix: dto.prefix }),
      },
    });
  }

  async updateAvatar(projectId: string, avatarUrl: string | null) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { avatarUrl },
    });
  }
}
