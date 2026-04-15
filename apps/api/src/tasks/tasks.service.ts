import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkflowService } from '../workflow/workflow.service';
import { WatchersService } from '../watchers/watchers.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Prisma } from '@prisma/client';
import type { NotificationType, EntityType } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private workflowService: WorkflowService,
    private watchersService: WatchersService,
  ) {}

  async create(projectId: string, creatorId: string, dto: CreateTaskDto) {
    const task = await this.prisma.$transaction(async (tx) => {
      let taskKey: string | null = null;

      if (dto.parentId) {
        // Creating a sub-task
        const parent = await tx.task.findUnique({
          where: { id: dto.parentId },
          select: { id: true, projectId: true, parentId: true, taskKey: true },
        });

        if (!parent || parent.projectId !== projectId) {
          throw new BadRequestException('Parent task not found in this project');
        }
        if (parent.parentId) {
          throw new BadRequestException('Cannot create sub-tasks on a sub-task (max 1 level)');
        }

        const updatedParent = await tx.task.update({
          where: { id: dto.parentId },
          data: { subTaskSequence: { increment: 1 } },
          select: { taskKey: true, subTaskSequence: true },
        });

        taskKey = updatedParent.taskKey
          ? `${updatedParent.taskKey}-${updatedParent.subTaskSequence}`
          : null;
      } else {
        const project = await tx.project.update({
          where: { id: projectId },
          data: { taskSeq: { increment: 1 } },
          select: { prefix: true, taskSeq: true },
        });
        taskKey = project.prefix ? `${project.prefix}-${project.taskSeq}` : null;
      }

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
          parentId: dto.parentId,
          estimatedMinutes: dto.estimatedMinutes,
          plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : undefined,
          plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
          actualStartDate: dto.actualStartDate ? new Date(dto.actualStartDate) : undefined,
          actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : undefined,
        },
        include: {
          assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          sprint: { select: { id: true, name: true } },
          workflowStatus: true,
        },
      });
    });

    this.notifications.notifyProject(projectId, 'task:created', { projectId, task });

    // Notify assignee when task is created with an assignee
    if (task.assigneeId && task.assigneeId !== creatorId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { prefix: true },
      });
      const taskTitle = task.taskKey ? `${task.taskKey}: ${task.title}` : task.title;
      await this.notifications.createMany([{
        recipientId: task.assigneeId,
        projectId,
        type: 'ASSIGNEE_CHANGE' as NotificationType,
        entityType: 'TASK' as EntityType,
        entityId: task.id,
        entityTitle: taskTitle,
        actorId: creatorId,
        summary: 'assigned this task to you',
        metadata: {
          field: 'assigneeId',
          ...(project?.prefix && { projectPrefix: project.prefix }),
          ...(task.taskKey && { entityKey: task.taskKey }),
        } as unknown as Prisma.InputJsonValue,
      }]);
    }

    return task;
  }

  async findByTaskKey(taskKey: string) {
    return this.prisma.task.findUnique({
      where: { taskKey },
      include: {
        assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        sprint: { select: { id: true, name: true } },
        creator: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        workflowStatus: true,
        parent: { select: { id: true, taskKey: true, title: true } },
        children: {
          include: {
            assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
            sprint: { select: { id: true, name: true } },
            workflowStatus: true,
            timeLogs: { select: { minutes: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        timeLogs: {
          orderBy: { loggedAt: 'desc' },
          include: {
            user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          },
        },
      },
    });
  }

  async findAll(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId, parentId: null },
      include: {
        assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        sprint: { select: { id: true, name: true } },
        workflowStatus: true,
        children: {
          include: {
            assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
            sprint: { select: { id: true, name: true } },
            workflowStatus: true,
            timeLogs: { select: { minutes: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        timeLogs: { select: { minutes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(taskId: string) {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        sprint: { select: { id: true, name: true } },
        creator: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        workflowStatus: true,
        parent: { select: { id: true, taskKey: true, title: true } },
        children: {
          include: {
            assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
            sprint: { select: { id: true, name: true } },
            workflowStatus: true,
            timeLogs: { select: { minutes: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        timeLogs: {
          orderBy: { loggedAt: 'desc' },
          include: {
            user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          },
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

    // Apply date automation rule and enforce closed-status progress check
    const autoDateUpdates: Partial<Record<'actualStartDate' | 'actualEndDate' | 'plannedStartDate' | 'plannedEndDate', Date | null>> = {};
    if (dto.workflowStatusId !== undefined && dto.workflowStatusId !== current.workflowStatusId && dto.workflowStatusId) {
      const targetStatus = await this.prisma.workflowStatus.findUnique({
        where: { id: dto.workflowStatusId },
        select: { isClosed: true, name: true, autoDateField: true, autoDateAction: true },
      });

      // Enforce: moving to a "closed" status requires progress = 100%
      if (targetStatus?.isClosed) {
        const effectiveProgress = dto.progress ?? current.progress;
        if (effectiveProgress < 100) {
          throw new BadRequestException(
            `Cannot move to "${targetStatus.name}" status. Progress must be 100% before closing. Current progress: ${effectiveProgress}%.`,
          );
        }
      }

      if (targetStatus?.autoDateField && targetStatus?.autoDateAction) {
        const field = targetStatus.autoDateField as keyof typeof autoDateUpdates;
        if (targetStatus.autoDateAction === 'set' && current[field] == null) {
          autoDateUpdates[field] = new Date();
        } else if (targetStatus.autoDateAction === 'clear') {
          autoDateUpdates[field] = null;
        }
      }
    }

    // Validate estimatedMinutes — cannot set on parent tasks
    if (dto.estimatedMinutes !== undefined) {
      const childCount = await this.prisma.task.count({ where: { parentId: taskId } });
      if (childCount > 0) {
        throw new BadRequestException('Cannot set estimate on a parent task. Estimates are auto-summed from sub-tasks.');
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

    // Track estimatedMinutes changes
    if (dto.estimatedMinutes !== undefined && dto.estimatedMinutes !== current.estimatedMinutes) {
      const oldFormatted = current.estimatedMinutes ? this.formatMinutes(current.estimatedMinutes) : null;
      const newFormatted = dto.estimatedMinutes ? this.formatMinutes(dto.estimatedMinutes) : null;
      historyEntries.push({
        taskId,
        actorId,
        field: 'estimatedMinutes',
        oldValue: oldFormatted,
        newValue: newFormatted,
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
          ...(dto.estimatedMinutes !== undefined && { estimatedMinutes: dto.estimatedMinutes }),
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
          assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
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

    // Trigger watcher notifications for tracked field changes
    const taskTitle = updatedTask.taskKey
      ? `${updatedTask.taskKey}: ${updatedTask.title}`
      : updatedTask.title;

    for (const entry of historyEntries) {
      const fieldToType: Record<string, NotificationType> = {
        status: 'STATUS_CHANGE' as NotificationType,
        assigneeId: 'ASSIGNEE_CHANGE' as NotificationType,
        priority: 'PRIORITY_CHANGE' as NotificationType,
        description: 'DESCRIPTION_EDIT' as NotificationType,
        acceptanceCriteria: 'CRITERIA_CHANGE' as NotificationType,
        sprintId: 'SPRINT_CHANGE' as NotificationType,
      };
      const notifType = fieldToType[entry.field];
      if (!notifType) continue;

      const summaryMap: Record<string, string> = {
        status: `changed status from "${entry.oldValue ?? 'none'}" to "${entry.newValue}"`,
        assigneeId: 'changed assignee',
        priority: `changed priority from "${entry.oldValue ?? 'none'}" to "${entry.newValue}"`,
        description: 'updated the description',
        acceptanceCriteria: 'updated acceptance criteria',
        sprintId: 'moved to a different sprint',
      };

      void this.triggerWatcherNotifications({
        projectId: current.projectId,
        entityId: taskId,
        entityTitle: taskTitle,
        entityKey: updatedTask.taskKey,
        type: notifType,
        actorId,
        summary: summaryMap[entry.field],
        metadata: { field: entry.field, oldValue: entry.oldValue, newValue: entry.newValue },
      });
    }

    // Directly notify the new assignee when assigned (if not the actor and not already a watcher)
    if (dto.assigneeId && dto.assigneeId !== current.assigneeId && dto.assigneeId !== actorId) {
      const watcherIds = await this.watchersService.getWatcherUserIds('TASK' as EntityType, taskId);
      if (!watcherIds.includes(dto.assigneeId)) {
        const project = await this.prisma.project.findUnique({
          where: { id: current.projectId },
          select: { prefix: true },
        });
        await this.notifications.createMany([{
          recipientId: dto.assigneeId,
          projectId: current.projectId,
          type: 'ASSIGNEE_CHANGE' as NotificationType,
          entityType: 'TASK' as EntityType,
          entityId: taskId,
          entityTitle: taskTitle,
          actorId,
          summary: 'assigned this task to you',
          metadata: {
            field: 'assigneeId',
            ...(project?.prefix && { projectPrefix: project.prefix }),
            ...(updatedTask.taskKey && { entityKey: updatedTask.taskKey }),
          } as unknown as Prisma.InputJsonValue,
        }]);
      }
    }

    return updatedTask;
  }

  async getHistory(taskId: string) {
    return this.prisma.taskHistory.findMany({
      where: { taskId },
      include: {
        actor: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByAssignee(userId: string) {
    return this.prisma.task.findMany({
      where: { assigneeId: userId },
      include: {
        assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        sprint: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, prefix: true } },
        workflowStatus: true,
        _count: { select: { children: true } },
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

  private formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  async exportExcel(projectId: string, filters: {
    workflowStatusId?: string;
    assigneeId?: string;
    sprintId?: string;
    priority?: string;
    plannedStartFrom?: string;
    plannedStartTo?: string;
    plannedEndFrom?: string;
    plannedEndTo?: string;
    overdue?: string;
    search?: string;
  }): Promise<Buffer> {
    const where: any = { projectId, parentId: null };

    if (filters.workflowStatusId) {
      where.workflowStatusId = { in: filters.workflowStatusId.split(',') };
    }
    if (filters.assigneeId) {
      where.assigneeId = { in: filters.assigneeId.split(',') };
    }
    if (filters.sprintId) {
      where.sprintId = { in: filters.sprintId.split(',') };
    }
    if (filters.priority) {
      where.priority = { in: filters.priority.split(',') };
    }
    if (filters.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }

    // Date filters on plannedStartDate
    if (filters.plannedStartFrom || filters.plannedStartTo) {
      where.plannedStartDate = {};
      if (filters.plannedStartFrom) where.plannedStartDate.gte = new Date(filters.plannedStartFrom);
      if (filters.plannedStartTo) where.plannedStartDate.lte = new Date(filters.plannedStartTo);
    }

    // Date filters on plannedEndDate
    if (filters.plannedEndFrom || filters.plannedEndTo) {
      where.plannedEndDate = {};
      if (filters.plannedEndFrom) where.plannedEndDate.gte = new Date(filters.plannedEndFrom);
      if (filters.plannedEndTo) where.plannedEndDate.lte = new Date(filters.plannedEndTo);
    }

    // Overdue: plannedEndDate < now AND no actualEndDate
    if (filters.overdue === 'true') {
      where.plannedEndDate = { ...where.plannedEndDate, lt: new Date() };
      where.actualEndDate = null;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, username: true, name: true } },
        sprint: { select: { id: true, name: true } },
        workflowStatus: true,
        timeLogs: { select: { minutes: true } },
        children: {
          include: {
            assignee: { select: { id: true, username: true, name: true } },
            workflowStatus: true,
            timeLogs: { select: { minutes: true } },
            sprint: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flatten: parent tasks + their children
    const rows: any[] = [];
    for (const task of tasks) {
      rows.push(task);
      if (task.children) {
        for (const child of task.children) {
          rows.push(child);
        }
      }
    }

    const ExcelJS = await import('exceljs');
    const Workbook = ExcelJS.default?.Workbook ?? ExcelJS.Workbook;
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Tasks');

    sheet.columns = [
      { header: 'Task Key', key: 'taskKey', width: 14 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Assignee', key: 'assignee', width: 20 },
      { header: 'Sprint', key: 'sprint', width: 18 },
      { header: 'Story Points', key: 'storyPoints', width: 14 },
      { header: 'Estimated (min)', key: 'estimatedMinutes', width: 16 },
      { header: 'Time Logged (min)', key: 'timeLogged', width: 18 },
      { header: 'Planned Start', key: 'plannedStartDate', width: 16 },
      { header: 'Planned End', key: 'plannedEndDate', width: 16 },
      { header: 'Actual Start', key: 'actualStartDate', width: 16 },
      { header: 'Actual End', key: 'actualEndDate', width: 16 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    // Style header row: bold, gray background, borders
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { wrapText: true, vertical: 'middle' };
    });

    for (const t of rows) {
      const totalMinutes = (t.timeLogs ?? []).reduce((sum: number, tl: any) => sum + tl.minutes, 0);
      const row = sheet.addRow({
        taskKey: t.taskKey ?? '',
        title: t.title,
        description: t.description ?? '',
        status: t.workflowStatus?.name ?? '',
        priority: t.priority ?? '',
        assignee: t.assignee?.name ?? t.assignee?.username ?? '',
        sprint: t.sprint?.name ?? '',
        storyPoints: t.storyPoints ?? '',
        estimatedMinutes: t.estimatedMinutes ?? '',
        timeLogged: totalMinutes || '',
        plannedStartDate: t.plannedStartDate ? new Date(t.plannedStartDate).toISOString().split('T')[0] : '',
        plannedEndDate: t.plannedEndDate ? new Date(t.plannedEndDate).toISOString().split('T')[0] : '',
        actualStartDate: t.actualStartDate ? new Date(t.actualStartDate).toISOString().split('T')[0] : '',
        actualEndDate: t.actualEndDate ? new Date(t.actualEndDate).toISOString().split('T')[0] : '',
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '',
      });
      row.eachCell((cell) => {
        cell.alignment = { wrapText: true, vertical: 'top' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async triggerWatcherNotifications(opts: {
    projectId: string;
    entityId: string;
    entityTitle: string;
    entityKey?: string | null;
    type: NotificationType;
    actorId: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }) {
    const watcherIds = await this.watchersService.getWatcherUserIds('TASK' as EntityType, opts.entityId);
    const recipientIds = watcherIds.filter((id) => id !== opts.actorId);
    if (recipientIds.length === 0) return;

    const project = await this.prisma.project.findUnique({
      where: { id: opts.projectId },
      select: { prefix: true },
    });

    const enrichedMetadata = {
      ...opts.metadata,
      ...(project?.prefix && { projectPrefix: project.prefix }),
      ...(opts.entityKey && { entityKey: opts.entityKey }),
    };

    const data = recipientIds.map((recipientId) => ({
      recipientId,
      projectId: opts.projectId,
      type: opts.type,
      entityType: 'TASK' as EntityType,
      entityId: opts.entityId,
      entityTitle: opts.entityTitle,
      actorId: opts.actorId,
      summary: opts.summary,
      metadata: enrichedMetadata as Prisma.InputJsonValue | undefined,
    }));
    await this.notifications.createMany(data);
  }
}
