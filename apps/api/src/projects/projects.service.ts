import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private workflowService: WorkflowService,
  ) {}

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          name: dto.name?.trim() || 'Untitled Project',
          description: dto.description,
          prefix: dto.prefix?.trim() || 'US',
          ownerId: userId,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: p.id,
          userId,
          role: 'pm',
        },
      });

      return p;
    });

    await this.workflowService.seedDefaultWorkflow(project.id);
    await this.workflowService.seedDefaultBugWorkflow(project.id);

    return project;
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
            workflowStatuses: {
              select: { id: true, isClosed: true, key: true },
            },
            tasks: {
              select: { workflowStatusId: true },
              where: { workflowStatusId: { not: null } },
            },
          },
        },
      },
    });

    return memberships
      .filter((m) => !m.project.archived)
      .map((m) => {
        const closedIds = new Set(
          m.project.workflowStatuses.filter((s) => s.isClosed).map((s) => s.id),
        );

        const activeCount = m.project.tasks.filter(
          (t) => t.workflowStatusId && !closedIds.has(t.workflowStatusId),
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
            active: activeCount,
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
              select: { id: true, email: true, username: true, name: true, imageUrl: true },
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
        ...(dto.prefix !== undefined && { prefix: dto.prefix }),
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
              select: { id: true, email: true, username: true, name: true, imageUrl: true },
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
        ...(dto.emailNotificationsEnabled !== undefined && {
          emailNotificationsEnabled: dto.emailNotificationsEnabled,
        }),
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
