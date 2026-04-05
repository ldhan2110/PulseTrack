import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBugDto } from './dto/create-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';

const BUG_RELATIONS = {
  reporter: { select: { id: true, username: true, email: true } },
  assignee: { select: { id: true, username: true, email: true } },
};

@Injectable()
export class BugsService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, reporterId: string, dto: CreateBugDto) {
    return this.prisma.bug.create({
      data: {
        projectId,
        reporterId,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        reproductionSteps: dto.reproductionSteps,
        environment: dto.environment,
        assigneeId: dto.assigneeId,
      },
      include: BUG_RELATIONS,
    });
  }

  async findAll(projectId: string) {
    return this.prisma.bug.findMany({
      where: { projectId },
      include: BUG_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(bugId: string) {
    return this.prisma.bug.findUnique({
      where: { id: bugId },
      include: BUG_RELATIONS,
    });
  }

  async update(bugId: string, dto: UpdateBugDto) {
    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.reproductionSteps !== undefined) data.reproductionSteps = dto.reproductionSteps;
    if (dto.environment !== undefined) data.environment = dto.environment;
    if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.bug.update({
      where: { id: bugId },
      data,
      include: BUG_RELATIONS,
    });
  }

  async delete(bugId: string) {
    return this.prisma.bug.delete({
      where: { id: bugId },
    });
  }
}
