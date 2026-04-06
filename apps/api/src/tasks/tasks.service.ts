import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateSubTaskDto } from './dto/create-subtask.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, creatorId: string, dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        projectId,
        creatorId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        assigneeId: dto.assigneeId,
        storyPoints: dto.storyPoints,
        sprintId: dto.sprintId,
        acceptanceCriteria: dto.acceptanceCriteria,
      },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        sprint: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        sprint: { select: { id: true, name: true } },
        _count: { select: { subTasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(taskId: string) {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        sprint: { select: { id: true, name: true } },
        creator: { select: { id: true, username: true, email: true } },
        subTasks: {
          include: {
            assignee: { select: { id: true, username: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async update(taskId: string, dto: UpdateTaskDto) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.storyPoints !== undefined && { storyPoints: dto.storyPoints }),
        ...(dto.sprintId !== undefined && { sprintId: dto.sprintId }),
        ...(dto.acceptanceCriteria !== undefined && {
          acceptanceCriteria: dto.acceptanceCriteria,
        }),
      },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        sprint: { select: { id: true, name: true } },
      },
    });
  }

  async delete(taskId: string) {
    return this.prisma.task.delete({
      where: { id: taskId },
    });
  }

  async createSubTask(taskId: string, dto: CreateSubTaskDto) {
    return this.prisma.subTask.create({
      data: {
        parentId: taskId,
        title: dto.title,
        status: dto.status,
        assigneeId: dto.assigneeId,
      },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async updateSubTask(subTaskId: string, dto: Partial<CreateSubTaskDto>) {
    return this.prisma.subTask.update({
      where: { id: subTaskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
      },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async deleteSubTask(subTaskId: string) {
    return this.prisma.subTask.delete({
      where: { id: subTaskId },
    });
  }
}
