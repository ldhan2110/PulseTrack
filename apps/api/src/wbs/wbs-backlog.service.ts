import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LinkBacklogDto } from './dto/link-backlog.dto';
import { WbsService } from './wbs.service';

@Injectable()
export class WbsBacklogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wbsService: WbsService,
  ) {}

  async linkTask(taskId: string, dto: LinkBacklogDto) {
    const task = await this.prisma.wbsTask.findUnique({
      where: { id: taskId },
      include: { _count: { select: { subtasks: true } } },
    });
    if (!task) throw new NotFoundException('WBS task not found');
    if (task._count.subtasks > 0) {
      throw new BadRequestException('Cannot link backlog to a task with subtasks. Only leaf nodes can be linked.');
    }
    await this.validateBacklogItem(dto.backlogItemId);
    await this.ensureNotAlreadyLinked(dto.backlogItemId);

    const updated = await this.prisma.wbsTask.update({
      where: { id: taskId },
      data: { backlogItemId: dto.backlogItemId },
      include: { subtasks: { orderBy: { position: 'asc' } } },
    });
    return updated;
  }

  async unlinkTask(taskId: string) {
    const task = await this.prisma.wbsTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('WBS task not found');
    return this.prisma.wbsTask.update({
      where: { id: taskId },
      data: { backlogItemId: null },
      include: { subtasks: { orderBy: { position: 'asc' } } },
    });
  }

  async linkSubtask(subtaskId: string, dto: LinkBacklogDto) {
    const subtask = await this.prisma.wbsSubtask.findUnique({ where: { id: subtaskId } });
    if (!subtask) throw new NotFoundException('WBS subtask not found');
    await this.validateBacklogItem(dto.backlogItemId);
    await this.ensureNotAlreadyLinked(dto.backlogItemId);

    const updated = await this.prisma.wbsSubtask.update({
      where: { id: subtaskId },
      data: { backlogItemId: dto.backlogItemId },
    });
    // Sync progress from backlog item
    const backlogItem = await this.prisma.task.findUnique({ where: { id: dto.backlogItemId } });
    if (backlogItem && backlogItem.progress !== undefined) {
      await this.prisma.wbsSubtask.update({
        where: { id: subtaskId },
        data: { progress: backlogItem.progress },
      });
      await this.wbsService.rollupTask(subtask.taskId);
      const task = await this.prisma.wbsTask.findUnique({ where: { id: subtask.taskId } });
      if (task) await this.wbsService.rollupPhase(task.phaseId);
    }
    return updated;
  }

  async unlinkSubtask(subtaskId: string) {
    const subtask = await this.prisma.wbsSubtask.findUnique({ where: { id: subtaskId } });
    if (!subtask) throw new NotFoundException('WBS subtask not found');
    return this.prisma.wbsSubtask.update({
      where: { id: subtaskId },
      data: { backlogItemId: null },
    });
  }

  private async validateBacklogItem(backlogItemId: string) {
    const item = await this.prisma.task.findUnique({ where: { id: backlogItemId } });
    if (!item) throw new NotFoundException('Backlog item not found');
  }

  private async ensureNotAlreadyLinked(backlogItemId: string) {
    const linkedTask = await this.prisma.wbsTask.findFirst({ where: { backlogItemId } });
    const linkedSubtask = await this.prisma.wbsSubtask.findFirst({ where: { backlogItemId } });
    if (linkedTask || linkedSubtask) {
      throw new BadRequestException('This backlog item is already linked to another WBS node');
    }
  }
}
