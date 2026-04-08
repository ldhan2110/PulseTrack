import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';

@Injectable()
export class SprintsService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, dto: CreateSprintDto) {
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('End date must be after start date');
    }

    return this.prisma.sprint.create({
      data: {
        projectId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: 'PLANNED',
      },
    });
  }

  async findAll(projectId: string) {
    const sprints = await this.prisma.sprint.findMany({
      where: { projectId },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          select: {
            storyPoints: true,
            workflowStatus: { select: { isClosed: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return sprints.map((sprint) => {
      const totalPoints = sprint.tasks.reduce(
        (sum, t) => sum + (t.storyPoints ?? 0),
        0,
      );
      const completedPoints = sprint.tasks
        .filter((t) => t.workflowStatus?.isClosed === true)
        .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

      return {
        ...sprint,
        totalPoints,
        completedPoints,
      };
    });
  }

  async findOne(sprintId: string) {
    return this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        tasks: {
          include: {
            assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async update(sprintId: string, dto: UpdateSprintDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);

    return this.prisma.sprint.update({
      where: { id: sprintId },
      data,
    });
  }

  async activate(sprintId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sprint = await tx.sprint.findUnique({
        where: { id: sprintId },
        select: { projectId: true },
      });

      if (!sprint) {
        throw new BadRequestException('Sprint not found');
      }

      const activeCount = await tx.sprint.count({
        where: {
          projectId: sprint.projectId,
          status: 'ACTIVE',
        },
      });

      if (activeCount > 0) {
        throw new ConflictException('Project already has an active sprint');
      }

      return tx.sprint.update({
        where: { id: sprintId },
        data: { status: 'ACTIVE' },
      });
    });
  }

  async closeSprint(sprintId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Move all non-closed tasks back to backlog
      const moveResult = await tx.task.updateMany({
        where: {
          sprintId,
          workflowStatus: { isClosed: false },
        },
        data: { sprintId: null },
      });

      // Mark sprint as COMPLETED
      const sprint = await tx.sprint.update({
        where: { id: sprintId },
        data: { status: 'COMPLETED' },
      });

      return {
        sprint,
        movedToBacklog: moveResult.count,
      };
    });
  }

  async getSprintStats(sprintId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { sprintId },
      select: { storyPoints: true, workflowStatus: { select: { isClosed: true } } },
    });

    const totalPoints = tasks.reduce(
      (sum, t) => sum + (t.storyPoints ?? 0),
      0,
    );
    const completedPoints = tasks
      .filter((t) => t.workflowStatus?.isClosed === true)
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const remainingPoints = totalPoints - completedPoints;
    const taskCount = tasks.length;
    const completedTaskCount = tasks.filter((t) => t.workflowStatus?.isClosed === true).length;

    return {
      totalPoints,
      completedPoints,
      remainingPoints,
      taskCount,
      completedTaskCount,
    };
  }
}
