import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBugDto } from './dto/create-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';

const BUG_RELATIONS = {
  reporter: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
  assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
  workflowStatus: true,
  reproSteps: { orderBy: { position: 'asc' as const } },
  parentTask: { select: { id: true, taskKey: true, title: true } },
};

@Injectable()
export class BugsService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, reporterId: string, dto: CreateBugDto) {
    const initialStatus = await this.prisma.workflowStatus.findFirst({
      where: { projectId, kind: 'BUG', isDefault: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const bug = await tx.bug.create({
        data: {
          projectId,
          reporterId,
          title: dto.title,
          description: dto.description,
          severity: dto.severity,
          environment: dto.environment,
          expectedResult: dto.expectedResult,
          actualResult: dto.actualResult,
          assigneeId: dto.assigneeId,
          parentTaskId: dto.parentTaskId,
          workflowStatusId: initialStatus?.id ?? null,
        },
        include: BUG_RELATIONS,
      });

      if (dto.reproSteps?.length) {
        await tx.bugReproStep.createMany({
          data: dto.reproSteps.map((s) => ({
            bugId: bug.id,
            position: s.position,
            content: s.content,
          })),
        });
      }

      return tx.bug.findUniqueOrThrow({
        where: { id: bug.id },
        include: BUG_RELATIONS,
      });
    });
  }

  async findAll(projectId: string, filters?: {
    severity?: string;
    workflowStatusId?: string;
    assigneeId?: string;
    parentTaskId?: string;
    reporterId?: string;
    search?: string;
  }) {
    const where: any = { projectId };
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.workflowStatusId) where.workflowStatusId = filters.workflowStatusId;
    if (filters?.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters?.parentTaskId) where.parentTaskId = filters.parentTaskId;
    if (filters?.reporterId) where.reporterId = filters.reporterId;
    if (filters?.search) where.title = { contains: filters.search, mode: 'insensitive' };

    return this.prisma.bug.findMany({
      where,
      include: BUG_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(bugId: string) {
    return this.prisma.bug.findUnique({
      where: { id: bugId },
      include: {
        ...BUG_RELATIONS,
        attachments: {
          include: {
            uploader: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async update(bugId: string, dto: UpdateBugDto) {
    return this.prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.severity !== undefined) data.severity = dto.severity;
      if (dto.environment !== undefined) data.environment = dto.environment;
      if (dto.expectedResult !== undefined) data.expectedResult = dto.expectedResult;
      if (dto.actualResult !== undefined) data.actualResult = dto.actualResult;
      if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
      if (dto.parentTaskId !== undefined) data.parentTaskId = dto.parentTaskId;
      if (dto.workflowStatusId !== undefined) data.workflowStatusId = dto.workflowStatusId;

      const bug = await tx.bug.update({
        where: { id: bugId },
        data,
        include: BUG_RELATIONS,
      });

      if (dto.reproSteps !== undefined) {
        await tx.bugReproStep.deleteMany({ where: { bugId } });
        if (dto.reproSteps.length > 0) {
          await tx.bugReproStep.createMany({
            data: dto.reproSteps.map((s) => ({
              bugId,
              position: s.position,
              content: s.content,
            })),
          });
        }
      }

      return tx.bug.findUniqueOrThrow({
        where: { id: bugId },
        include: BUG_RELATIONS,
      });
    });
  }

  async delete(bugId: string) {
    return this.prisma.bug.delete({ where: { id: bugId } });
  }
}
