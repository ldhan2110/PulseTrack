import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { ReorderDto } from './dto/reorder.dto';

const PHASE_INCLUDE = {
  tasks: {
    orderBy: { position: 'asc' as const },
    include: {
      subtasks: { orderBy: { position: 'asc' as const } },
    },
  },
};

@Injectable()
export class WbsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Phases ──────────────────────────────────────────────

  async listPhases(projectId: string) {
    return this.prisma.wbsPhase.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      include: PHASE_INCLUDE,
    });
  }

  async createPhase(projectId: string, dto: CreatePhaseDto) {
    const maxPos = await this.prisma.wbsPhase.aggregate({
      where: { projectId },
      _max: { position: true },
    });
    return this.prisma.wbsPhase.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: PHASE_INCLUDE,
    });
  }

  async updatePhase(phaseId: string, dto: UpdatePhaseDto) {
    await this.ensurePhaseExists(phaseId);
    return this.prisma.wbsPhase.update({
      where: { id: phaseId },
      data: dto,
      include: PHASE_INCLUDE,
    });
  }

  async deletePhase(phaseId: string) {
    await this.ensurePhaseExists(phaseId);
    return this.prisma.wbsPhase.delete({ where: { id: phaseId } });
  }

  async reorderPhases(projectId: string, dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.wbsPhase.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
    return this.listPhases(projectId);
  }

  // ─── Tasks ───────────────────────────────────────────────

  async createTask(phaseId: string, dto: CreateTaskDto) {
    await this.ensurePhaseExists(phaseId);
    const maxPos = await this.prisma.wbsTask.aggregate({
      where: { phaseId },
      _max: { position: true },
    });
    const task = await this.prisma.wbsTask.create({
      data: {
        phaseId,
        title: dto.title,
        description: dto.description,
        position: (maxPos._max.position ?? -1) + 1,
        planStart: dto.planStart ? new Date(dto.planStart) : undefined,
        planEnd: dto.planEnd ? new Date(dto.planEnd) : undefined,
      },
      include: { subtasks: { orderBy: { position: 'asc' } } },
    });
    await this.rollupPhase(phaseId);
    return task;
  }

  async updateTask(taskId: string, dto: UpdateTaskDto) {
    const task = await this.ensureTaskExists(taskId);
    const hasSubtasks = await this.prisma.wbsSubtask.count({ where: { taskId } });
    if (hasSubtasks > 0) {
      // Only allow title/description updates on parent tasks
      const { planStart, planEnd, actualStart, actualEnd, progress, ...allowed } = dto;
      if (planStart !== undefined || planEnd !== undefined || actualStart !== undefined || actualEnd !== undefined || progress !== undefined) {
        throw new BadRequestException('Cannot manually set dates/progress on a task with subtasks. Values are auto-calculated.');
      }
      const updated = await this.prisma.wbsTask.update({
        where: { id: taskId },
        data: allowed,
        include: { subtasks: { orderBy: { position: 'asc' } } },
      });
      return updated;
    }
    const updated = await this.prisma.wbsTask.update({
      where: { id: taskId },
      data: {
        ...dto,
        planStart: dto.planStart ? new Date(dto.planStart) : undefined,
        planEnd: dto.planEnd ? new Date(dto.planEnd) : undefined,
        actualStart: dto.actualStart ? new Date(dto.actualStart) : undefined,
        actualEnd: dto.actualEnd ? new Date(dto.actualEnd) : undefined,
      },
      include: { subtasks: { orderBy: { position: 'asc' } } },
    });
    await this.rollupPhase(task.phaseId);
    return updated;
  }

  async deleteTask(taskId: string) {
    const task = await this.ensureTaskExists(taskId);
    await this.prisma.wbsTask.delete({ where: { id: taskId } });
    await this.rollupPhase(task.phaseId);
  }

  async reorderTasks(phaseId: string, dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.wbsTask.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
  }

  // ─── Subtasks ────────────────────────────────────────────

  async createSubtask(taskId: string, dto: CreateSubtaskDto) {
    const task = await this.ensureTaskExists(taskId);
    // If the parent task had a backlogItemId, remove it (no longer a leaf)
    if (task.backlogItemId) {
      await this.prisma.wbsTask.update({
        where: { id: taskId },
        data: { backlogItemId: null },
      });
    }
    const maxPos = await this.prisma.wbsSubtask.aggregate({
      where: { taskId },
      _max: { position: true },
    });
    const subtask = await this.prisma.wbsSubtask.create({
      data: {
        taskId,
        title: dto.title,
        description: dto.description,
        position: (maxPos._max.position ?? -1) + 1,
        planStart: dto.planStart ? new Date(dto.planStart) : undefined,
        planEnd: dto.planEnd ? new Date(dto.planEnd) : undefined,
      },
    });
    await this.rollupTask(taskId);
    await this.rollupPhase(task.phaseId);
    return subtask;
  }

  async updateSubtask(subtaskId: string, dto: UpdateSubtaskDto) {
    const subtask = await this.ensureSubtaskExists(subtaskId);
    const updated = await this.prisma.wbsSubtask.update({
      where: { id: subtaskId },
      data: {
        ...dto,
        planStart: dto.planStart ? new Date(dto.planStart) : undefined,
        planEnd: dto.planEnd ? new Date(dto.planEnd) : undefined,
        actualStart: dto.actualStart ? new Date(dto.actualStart) : undefined,
        actualEnd: dto.actualEnd ? new Date(dto.actualEnd) : undefined,
      },
    });
    const task = await this.prisma.wbsTask.findUnique({ where: { id: subtask.taskId } });
    await this.rollupTask(subtask.taskId);
    if (task) await this.rollupPhase(task.phaseId);
    return updated;
  }

  async deleteSubtask(subtaskId: string) {
    const subtask = await this.ensureSubtaskExists(subtaskId);
    await this.prisma.wbsSubtask.delete({ where: { id: subtaskId } });
    const task = await this.prisma.wbsTask.findUnique({ where: { id: subtask.taskId } });
    await this.rollupTask(subtask.taskId);
    if (task) await this.rollupPhase(task.phaseId);
  }

  async reorderSubtasks(taskId: string, dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.wbsSubtask.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
  }

  // ─── Rollup ──────────────────────────────────────────────

  async rollupTask(taskId: string) {
    const subtasks = await this.prisma.wbsSubtask.findMany({ where: { taskId } });
    if (subtasks.length === 0) return;

    const planStarts = subtasks.map((s) => s.planStart).filter(Boolean) as Date[];
    const planEnds = subtasks.map((s) => s.planEnd).filter(Boolean) as Date[];
    const actualStarts = subtasks.map((s) => s.actualStart).filter(Boolean) as Date[];
    const actualEnds = subtasks.map((s) => s.actualEnd).filter(Boolean) as Date[];
    const allComplete = subtasks.every((s) => s.actualEnd !== null);
    const avgProgress = subtasks.reduce((sum, s) => sum + s.progress, 0) / subtasks.length;

    await this.prisma.wbsTask.update({
      where: { id: taskId },
      data: {
        planStart: planStarts.length ? new Date(Math.min(...planStarts.map((d) => d.getTime()))) : null,
        planEnd: planEnds.length ? new Date(Math.max(...planEnds.map((d) => d.getTime()))) : null,
        actualStart: actualStarts.length ? new Date(Math.min(...actualStarts.map((d) => d.getTime()))) : null,
        actualEnd: allComplete && actualEnds.length ? new Date(Math.max(...actualEnds.map((d) => d.getTime()))) : null,
        progress: Math.round(avgProgress * 100) / 100,
      },
    });
  }

  async rollupPhase(phaseId: string) {
    const tasks = await this.prisma.wbsTask.findMany({ where: { phaseId } });
    if (tasks.length === 0) {
      await this.prisma.wbsPhase.update({
        where: { id: phaseId },
        data: { planStart: null, planEnd: null, actualStart: null, actualEnd: null, progress: 0 },
      });
      return;
    }

    const planStarts = tasks.map((t) => t.planStart).filter(Boolean) as Date[];
    const planEnds = tasks.map((t) => t.planEnd).filter(Boolean) as Date[];
    const actualStarts = tasks.map((t) => t.actualStart).filter(Boolean) as Date[];
    const actualEnds = tasks.map((t) => t.actualEnd).filter(Boolean) as Date[];
    const allComplete = tasks.every((t) => t.actualEnd !== null);
    const avgProgress = tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length;

    await this.prisma.wbsPhase.update({
      where: { id: phaseId },
      data: {
        planStart: planStarts.length ? new Date(Math.min(...planStarts.map((d) => d.getTime()))) : null,
        planEnd: planEnds.length ? new Date(Math.max(...planEnds.map((d) => d.getTime()))) : null,
        actualStart: actualStarts.length ? new Date(Math.min(...actualStarts.map((d) => d.getTime()))) : null,
        actualEnd: allComplete && actualEnds.length ? new Date(Math.max(...actualEnds.map((d) => d.getTime()))) : null,
        progress: Math.round(avgProgress * 100) / 100,
      },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────

  private async ensurePhaseExists(phaseId: string) {
    const phase = await this.prisma.wbsPhase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new NotFoundException('WBS phase not found');
    return phase;
  }

  private async ensureTaskExists(taskId: string) {
    const task = await this.prisma.wbsTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('WBS task not found');
    return task;
  }

  private async ensureSubtaskExists(subtaskId: string) {
    const subtask = await this.prisma.wbsSubtask.findUnique({ where: { id: subtaskId } });
    if (!subtask) throw new NotFoundException('WBS subtask not found');
    return subtask;
  }
}
