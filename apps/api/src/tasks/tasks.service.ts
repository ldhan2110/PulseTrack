import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkflowService } from '../workflow/workflow.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateSubTaskDto } from './dto/create-subtask.dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private workflowService: WorkflowService,
  ) {}

  async create(projectId: string, creatorId: string, dto: CreateTaskDto) {
    const task = await this.prisma.$transaction(async (tx) => {
      // Atomically increment the project's task sequence
      const project = await tx.project.update({
        where: { id: projectId },
        data: { taskSeq: { increment: 1 } },
        select: { prefix: true, taskSeq: true },
      });

      const taskKey = project.prefix ? `${project.prefix}-${project.taskSeq}` : null;

      // Find default workflow status for this project
      const defaultStatus = await tx.workflowStatus.findFirst({
        where: { projectId, isDefault: true },
      });

      return tx.task.create({
        data: {
          projectId,
          creatorId,
          title: dto.title,
          taskKey,
          description: dto.description,
          workflowStatusId: defaultStatus?.id ?? null,
          assigneeId: dto.assigneeId,
          storyPoints: dto.storyPoints,
          sprintId: dto.sprintId,
          acceptanceCriteria: dto.acceptanceCriteria,
          priority: dto.priority,
          plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : undefined,
          plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
          actualStartDate: dto.actualStartDate ? new Date(dto.actualStartDate) : undefined,
          actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : undefined,
        },
        include: {
          assignee: { select: { id: true, username: true, email: true } },
          sprint: { select: { id: true, name: true } },
          workflowStatus: true,
        },
      });
    });

    this.notifications.notifyProject(projectId, 'task:created', { projectId, task });
    return task;
  }

  async findByTaskKey(taskKey: string) {
    return this.prisma.task.findUnique({
      where: { taskKey },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        sprint: { select: { id: true, name: true } },
        creator: { select: { id: true, username: true, email: true } },
        workflowStatus: true,
        subTasks: {
          include: {
            assignee: { select: { id: true, username: true, email: true } },
            workflowStatus: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findAll(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        sprint: { select: { id: true, name: true } },
        workflowStatus: true,
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
        workflowStatus: true,
        subTasks: {
          include: {
            assignee: { select: { id: true, username: true, email: true } },
            workflowStatus: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async update(taskId: string, dto: UpdateTaskDto, actorId: string) {
    // Fetch current task to detect changes for history recording
    const current = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: { workflowStatus: true },
    });

    // Validate workflow status transition if changing workflowStatusId
    if (dto.workflowStatusId !== undefined && dto.workflowStatusId !== current.workflowStatusId) {
      if (current.workflowStatusId) {
        const validTransitions = await this.workflowService.getValidTransitions(
          current.projectId,
          current.workflowStatusId,
        );
        const isValid = validTransitions.some((t) => t.id === dto.workflowStatusId);
        if (!isValid) {
          const validNames = validTransitions.map((t) => t.name).join(', ');
          throw new BadRequestException(
            `Invalid status transition. Valid transitions from "${current.workflowStatus?.name}" are: ${validNames || 'none'}`,
          );
        }
      }
    }

    // Apply date automation rule if status is changing
    const autoDateUpdates: Partial<Record<'actualStartDate' | 'actualEndDate' | 'plannedStartDate' | 'plannedEndDate', Date | null>> = {};
    if (dto.workflowStatusId !== undefined && dto.workflowStatusId !== current.workflowStatusId && dto.workflowStatusId) {
      const targetStatus = await this.prisma.workflowStatus.findUnique({
        where: { id: dto.workflowStatusId },
        select: { autoDateField: true, autoDateAction: true },
      });
      if (targetStatus?.autoDateField && targetStatus?.autoDateAction) {
        const field = targetStatus.autoDateField as keyof typeof autoDateUpdates;
        if (targetStatus.autoDateAction === 'set' && current[field] == null) {
          autoDateUpdates[field] = new Date();
        } else if (targetStatus.autoDateAction === 'clear') {
          autoDateUpdates[field] = null;
        }
      }
    }

    // Build history entries for tracked fields only
    const trackedFields = ['assigneeId', 'sprintId', 'storyPoints', 'title', 'priority'] as const;
    const historyEntries: { taskId: string; actorId: string; field: string; oldValue: string | null; newValue: string | null }[] = trackedFields
      .filter(f => dto[f] !== undefined && String(dto[f] ?? '') !== String(current[f] ?? ''))
      .map(f => ({
        taskId,
        actorId,
        field: f as string,
        oldValue: current[f] != null ? String(current[f]) : null,
        newValue: dto[f] != null ? String(dto[f]) : null,
      }));

    // Track workflowStatus changes by name for readability
    if (dto.workflowStatusId !== undefined && dto.workflowStatusId !== current.workflowStatusId) {
      let newStatusName: string | null = null;
      if (dto.workflowStatusId) {
        const newStatus = await this.prisma.workflowStatus.findUnique({
          where: { id: dto.workflowStatusId },
          select: { name: true },
        });
        newStatusName = newStatus?.name ?? dto.workflowStatusId;
      }
      historyEntries.push({
        taskId,
        actorId,
        field: 'status',
        oldValue: current.workflowStatus?.name ?? null,
        newValue: newStatusName,
      });
    }

    // Track description changes
    if (dto.description !== undefined && dto.description !== current.description) {
      historyEntries.push({
        taskId,
        actorId,
        field: 'description',
        oldValue: current.description ? current.description.replace(/<[^>]*>/g, '').slice(0, 500) : null,
        newValue: dto.description ? dto.description.replace(/<[^>]*>/g, '').slice(0, 500) : null,
      });
    }

    // Track acceptance criteria changes
    if (dto.acceptanceCriteria !== undefined && dto.acceptanceCriteria !== current.acceptanceCriteria) {
      historyEntries.push({
        taskId,
        actorId,
        field: 'acceptanceCriteria',
        oldValue: current.acceptanceCriteria ?? null,
        newValue: dto.acceptanceCriteria ?? null,
      });
    }

    // Track date field changes (manual + auto)
    const dateFields = ['plannedStartDate', 'plannedEndDate', 'actualStartDate', 'actualEndDate'] as const;
    for (const f of dateFields) {
      const autoValue = autoDateUpdates[f];
      const manualValue = dto[f];
      if (manualValue !== undefined || autoValue !== undefined) {
        const oldRaw = current[f] ? (current[f] as Date).toISOString() : null;
        // Manual DTO value takes precedence; auto-date only applies if not manually set
        const newRaw = manualValue !== undefined
          ? (manualValue ? new Date(manualValue as string).toISOString() : null)
          : (autoValue ? autoValue.toISOString() : null);
        if (oldRaw !== newRaw) {
          historyEntries.push({
            taskId,
            actorId,
            field: f,
            oldValue: oldRaw,
            newValue: newRaw,
          });
        }
      }
    }

    // Execute update + history inserts in a single transaction
    const [updatedTask] = await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id: taskId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.workflowStatusId !== undefined && { workflowStatusId: dto.workflowStatusId }),
          ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
          ...(dto.storyPoints !== undefined && { storyPoints: dto.storyPoints }),
          ...(dto.sprintId !== undefined && { sprintId: dto.sprintId }),
          ...(dto.acceptanceCriteria !== undefined && {
            acceptanceCriteria: dto.acceptanceCriteria,
          }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...autoDateUpdates,
          ...(dto.plannedStartDate !== undefined && {
            plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : null,
          }),
          ...(dto.plannedEndDate !== undefined && {
            plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : null,
          }),
          ...(dto.actualStartDate !== undefined && {
            actualStartDate: dto.actualStartDate ? new Date(dto.actualStartDate) : null,
          }),
          ...(dto.actualEndDate !== undefined && {
            actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : null,
          }),
        },
        include: {
          assignee: { select: { id: true, username: true, email: true } },
          sprint: { select: { id: true, name: true } },
          workflowStatus: true,
        },
      }),
      ...historyEntries.map(e => this.prisma.taskHistory.create({ data: e })),
    ]);

    this.notifications.notifyProject(current.projectId, 'task:updated', {
      projectId: current.projectId,
      taskId,
      task: updatedTask,
    });

    // Notify the current assignee so their My Tasks page refreshes
    const effectiveAssigneeId = dto.assigneeId !== undefined ? dto.assigneeId : current.assigneeId;
    if (effectiveAssigneeId) {
      this.notifications.notifyUser(effectiveAssigneeId, 'task:updated', {
        projectId: current.projectId,
        taskId,
      });
    }
    // If assignee changed, also notify the previous assignee
    if (dto.assigneeId !== undefined && dto.assigneeId !== current.assigneeId && current.assigneeId) {
      this.notifications.notifyUser(current.assigneeId, 'task:updated', {
        projectId: current.projectId,
        taskId,
      });
    }

    return updatedTask;
  }

  async getHistory(taskId: string) {
    return this.prisma.taskHistory.findMany({
      where: { taskId },
      include: {
        actor: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByAssignee(userId: string) {
    return this.prisma.task.findMany({
      where: { assigneeId: userId },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        sprint: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, prefix: true } },
        workflowStatus: true,
        _count: { select: { subTasks: true } },
      },
      orderBy: [
        { plannedEndDate: { sort: 'asc', nulls: 'last' } },
        { priority: 'desc' },
      ],
    });
  }

  async delete(taskId: string) {
    const task = await this.prisma.task.delete({
      where: { id: taskId },
    });
    this.notifications.notifyProject(task.projectId, 'task:deleted', {
      projectId: task.projectId,
      taskId,
    });
    return task;
  }

  async createSubTask(taskId: string, dto: CreateSubTaskDto) {
    return this.prisma.subTask.create({
      data: {
        parentId: taskId,
        title: dto.title,
        workflowStatusId: dto.workflowStatusId,
        assigneeId: dto.assigneeId,
      },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        workflowStatus: true,
      },
    });
  }

  async updateSubTask(subTaskId: string, dto: Partial<CreateSubTaskDto>) {
    return this.prisma.subTask.update({
      where: { id: subTaskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.workflowStatusId !== undefined && { workflowStatusId: dto.workflowStatusId }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
      },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        workflowStatus: true,
      },
    });
  }

  async deleteSubTask(subTaskId: string) {
    return this.prisma.subTask.delete({
      where: { id: subTaskId },
    });
  }
}
