import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WatchersService } from '../watchers/watchers.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateBugDto } from './dto/create-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';
import { BulkImportBugsDto } from './dto/bulk-import-bugs.dto';
import { CreateFixTaskDto } from './dto/create-fix-task.dto';
import type { NotificationType, EntityType, Prisma } from '@prisma/client';

const BUG_RELATIONS = {
  reporter: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
  assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
  owner: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
  workflowStatus: true,
  reproSteps: { orderBy: { position: 'asc' as const } },
  bugTasks: {
    include: {
      task: {
        select: {
          id: true,
          taskKey: true,
          title: true,
          estimatedMinutes: true,
          timeLogs: {
            include: {
              user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
            },
            orderBy: { loggedAt: 'desc' as const },
          },
          children: {
            select: {
              id: true,
              taskKey: true,
              title: true,
              estimatedMinutes: true,
              timeLogs: {
                include: {
                  user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
                },
                orderBy: { loggedAt: 'desc' as const },
              },
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class BugsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private watchersService: WatchersService,
    @Inject(forwardRef(() => TasksService))
    private tasksService: TasksService,
  ) {}

  async create(projectId: string, reporterId: string, dto: CreateBugDto) {
    const initialStatus = await this.prisma.workflowStatus.findFirst({
      where: { projectId, kind: 'BUG', isDefault: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // Atomically increment bugSeq to generate bugKey
      const project = await tx.project.update({
        where: { id: projectId },
        data: { bugSeq: { increment: 1 } },
        select: { prefix: true, bugSeq: true },
      });
      const bugKey = project.prefix ? `${project.prefix}-BUG-${project.bugSeq}` : null;

      const bug = await tx.bug.create({
        data: {
          projectId,
          reporterId,
          bugKey,
          title: dto.title,
          description: dto.description,
          preconditions: dto.preconditions,
          severity: dto.severity,
          environment: dto.environment,
          expectedResult: dto.expectedResult,
          actualResult: dto.actualResult,
          assigneeId: dto.assigneeId,
          ownerId: dto.ownerId,
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

    this.notifications.notifyProject(projectId, 'bug:created', { projectId, bug: result });

    // Notify assignee when bug is created with an assignee
    if (result.assigneeId && result.assigneeId !== reporterId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { prefix: true },
      });
      const bugTitle = result.bugKey ? `${result.bugKey}: ${result.title}` : result.title;
      await this.notifications.createMany([{
        recipientId: result.assigneeId,
        projectId,
        type: 'ASSIGNEE_CHANGE' as NotificationType,
        entityType: 'BUG' as EntityType,
        entityId: result.id,
        entityTitle: bugTitle,
        actorId: reporterId,
        summary: 'assigned this bug to you',
        metadata: {
          field: 'assigneeId',
          ...(project?.prefix && { projectPrefix: project.prefix }),
          ...(result.bugKey && { entityKey: result.bugKey }),
        },
      }] as Prisma.NotificationCreateManyInput[]);
    }

    return result;
  }

  async findAll(projectId: string, filters?: {
    severity?: string;
    workflowStatusId?: string;
    assigneeId?: string;
    reporterId?: string;
    search?: string;
  }) {
    const where: any = { projectId };
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.workflowStatusId) where.workflowStatusId = filters.workflowStatusId;
    if (filters?.assigneeId) where.assigneeId = filters.assigneeId;
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

  async findByBugKey(bugKey: string) {
    return this.prisma.bug.findUnique({
      where: { bugKey },
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

  async getHistory(bugId: string) {
    return this.prisma.bugHistory.findMany({
      where: { bugId },
      include: {
        actor: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(bugId: string, dto: UpdateBugDto, actorId?: string) {
    // Only fetch old values when we actually need history tracking
    const needsHistory = actorId !== undefined;
    const oldBug = needsHistory
      ? await this.prisma.bug.findUniqueOrThrow({
          where: { id: bugId },
          select: {
            projectId: true, bugKey: true,
            title: true, description: true, severity: true, environment: true,
            expectedResult: true, actualResult: true, assigneeId: true, ownerId: true,
            workflowStatusId: true, workflowStatus: { select: { name: true } },
          },
        })
      : null;

    const historyEntries: { bugId: string; actorId: string; field: string; oldValue?: string | null; newValue?: string | null }[] = [];

    // Auto-clear orphaned workflowStatusId (ID set but status record missing)
    if (oldBug && oldBug.workflowStatusId && !oldBug.workflowStatus) {
      await this.prisma.bug.update({
        where: { id: bugId },
        data: { workflowStatusId: null },
      });
      oldBug.workflowStatusId = null;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.preconditions !== undefined) data.preconditions = dto.preconditions;
      if (dto.severity !== undefined) data.severity = dto.severity;
      if (dto.environment !== undefined) data.environment = dto.environment;
      if (dto.expectedResult !== undefined) data.expectedResult = dto.expectedResult;
      if (dto.actualResult !== undefined) data.actualResult = dto.actualResult;
      if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
      if (dto.ownerId !== undefined) data.ownerId = dto.ownerId;
      if (dto.workflowStatusId !== undefined) {
        if (dto.workflowStatusId !== null) {
          const targetExists = await tx.workflowStatus.findUnique({
            where: { id: dto.workflowStatusId },
            select: { id: true },
          });
          data.workflowStatusId = targetExists ? dto.workflowStatusId : null;
        } else {
          data.workflowStatusId = null;
        }
      }

      const bug = await tx.bug.update({
        where: { id: bugId },
        data,
        include: BUG_RELATIONS,
      });

      // Record history entries for changed fields
      if (actorId && oldBug) {
        if (dto.title !== undefined && dto.title !== oldBug.title) {
          historyEntries.push({ bugId, actorId, field: 'title', oldValue: oldBug.title, newValue: dto.title });
        }
        if (dto.description !== undefined && dto.description !== oldBug.description) {
          historyEntries.push({ bugId, actorId, field: 'description', oldValue: oldBug.description ?? null, newValue: dto.description ?? null });
        }
        if (dto.severity !== undefined && dto.severity !== oldBug.severity) {
          historyEntries.push({ bugId, actorId, field: 'severity', oldValue: oldBug.severity, newValue: dto.severity });
        }
        if (dto.environment !== undefined && dto.environment !== oldBug.environment) {
          historyEntries.push({ bugId, actorId, field: 'environment', oldValue: oldBug.environment ?? null, newValue: dto.environment ?? null });
        }
        if (dto.expectedResult !== undefined && dto.expectedResult !== oldBug.expectedResult) {
          historyEntries.push({ bugId, actorId, field: 'expectedResult', oldValue: oldBug.expectedResult ?? null, newValue: dto.expectedResult ?? null });
        }
        if (dto.actualResult !== undefined && dto.actualResult !== oldBug.actualResult) {
          historyEntries.push({ bugId, actorId, field: 'actualResult', oldValue: oldBug.actualResult ?? null, newValue: dto.actualResult ?? null });
        }
        if (dto.assigneeId !== undefined && dto.assigneeId !== oldBug.assigneeId) {
          historyEntries.push({ bugId, actorId, field: 'assigneeId', oldValue: oldBug.assigneeId ?? null, newValue: dto.assigneeId ?? null });
        }
        if (dto.ownerId !== undefined && dto.ownerId !== oldBug.ownerId) {
          historyEntries.push({ bugId, actorId, field: 'ownerId', oldValue: oldBug.ownerId ?? null, newValue: dto.ownerId ?? null });
        }
        if (dto.workflowStatusId !== undefined && dto.workflowStatusId !== oldBug.workflowStatusId) {
          historyEntries.push({ bugId, actorId, field: 'workflowStatusId', oldValue: oldBug.workflowStatus?.name ?? oldBug.workflowStatusId ?? null, newValue: (bug as any).workflowStatus?.name ?? dto.workflowStatusId ?? null });
        }

        if (historyEntries.length > 0) {
          await tx.bugHistory.createMany({ data: historyEntries });
        }
      }

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
        // Only re-fetch when reproSteps changed (need fresh relation data)
        return tx.bug.findUniqueOrThrow({
          where: { id: bugId },
          include: BUG_RELATIONS,
        });
      }

      return bug;
    });

    // Trigger watcher notifications for tracked field changes (outside transaction)
    if (actorId && oldBug && historyEntries.length > 0) {
      const bugTitle = oldBug.bugKey
        ? `${oldBug.bugKey}: ${(result as any).title}`
        : (result as any).title;

      const fieldToType: Record<string, NotificationType> = {
        workflowStatusId: 'STATUS_CHANGE' as NotificationType,
        assigneeId: 'ASSIGNEE_CHANGE' as NotificationType,
        severity: 'PRIORITY_CHANGE' as NotificationType,
        description: 'DESCRIPTION_EDIT' as NotificationType,
      };

      const summaryMap: Record<string, (e: typeof historyEntries[0]) => string> = {
        workflowStatusId: (e) => `changed status from "${e.oldValue ?? 'none'}" to "${e.newValue}"`,
        assigneeId: () => 'changed assignee',
        severity: (e) => `changed severity from "${e.oldValue ?? 'none'}" to "${e.newValue}"`,
        description: () => 'updated the description',
        title: (e) => `changed title from "${e.oldValue}" to "${e.newValue}"`,
        ownerId: () => 'changed owner',
      };

      for (const entry of historyEntries) {
        const notifType = fieldToType[entry.field];
        if (!notifType) continue;

        void this.triggerWatcherNotifications({
          projectId: oldBug.projectId,
          entityId: bugId,
          entityTitle: bugTitle,
          entityKey: oldBug.bugKey,
          type: notifType,
          actorId,
          summary: summaryMap[entry.field]?.(entry) ?? `updated ${entry.field}`,
          metadata: { field: entry.field, oldValue: entry.oldValue, newValue: entry.newValue },
        });
      }

      // Directly notify the new assignee when assigned (if not the actor and not already a watcher)
      if (dto.assigneeId && dto.assigneeId !== oldBug.assigneeId && dto.assigneeId !== actorId) {
        const watcherIds = await this.watchersService.getWatcherUserIds('BUG' as EntityType, bugId);
        if (!watcherIds.includes(dto.assigneeId)) {
          const project = await this.prisma.project.findUnique({
            where: { id: oldBug.projectId },
            select: { prefix: true },
          });
          await this.notifications.createMany([{
            recipientId: dto.assigneeId,
            projectId: oldBug.projectId,
            type: 'ASSIGNEE_CHANGE' as NotificationType,
            entityType: 'BUG' as EntityType,
            entityId: bugId,
            entityTitle: bugTitle,
            actorId,
            summary: 'assigned this bug to you',
            metadata: {
              field: 'assigneeId',
              ...(project?.prefix && { projectPrefix: project.prefix }),
              ...(oldBug.bugKey && { entityKey: oldBug.bugKey }),
            },
          }] as Prisma.NotificationCreateManyInput[]);
        }
      }
    }

    return result;
  }

  async bulkImport(projectId: string, reporterId: string, dto: BulkImportBugsDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch all BUG workflow statuses for this project
      const statuses = await tx.workflowStatus.findMany({
        where: { projectId, kind: 'BUG' },
        select: { id: true, name: true, isDefault: true },
      });

      const statusMap = new Map<string, string>();
      for (const s of statuses) {
        statusMap.set(s.name.toLowerCase(), s.id);
      }
      const defaultStatusId = statuses.find((s) => s.isDefault)?.id ?? null;

      // 2. Create bugs one-by-one (need sequential bugSeq increment)
      let created = 0;
      for (const item of dto.items) {
        const project = await tx.project.update({
          where: { id: projectId },
          data: { bugSeq: { increment: 1 } },
          select: { prefix: true, bugSeq: true },
        });
        const bugKey = project.prefix ? `${project.prefix}-BUG-${project.bugSeq}` : null;

        // Resolve status name to ID
        const resolvedStatusId = item.statusName
          ? statusMap.get(item.statusName.toLowerCase()) ?? defaultStatusId
          : defaultStatusId;

        const bug = await tx.bug.create({
          data: {
            projectId,
            reporterId,
            bugKey,
            title: item.title,
            description: item.description,
            preconditions: item.preconditions,
            severity: item.severity,
            environment: item.environment,
            expectedResult: item.expectedResult,
            actualResult: item.actualResult,
            workflowStatusId: resolvedStatusId,
          },
        });

        if (item.reproSteps?.length) {
          await tx.bugReproStep.createMany({
            data: item.reproSteps.map((s) => ({
              bugId: bug.id,
              position: s.position,
              content: s.content,
            })),
          });
        }

        created++;
      }

      return { created };
    });
  }

  async exportExcel(projectId: string, filters: {
    workflowStatusId?: string;
    severity?: string;
    assigneeId?: string;
    reporterId?: string;
    search?: string;
  }): Promise<Buffer> {
    const where: any = { projectId };

    if (filters.workflowStatusId) {
      where.workflowStatusId = { in: filters.workflowStatusId.split(',') };
    }
    if (filters.severity) {
      where.severity = { in: filters.severity.split(',') };
    }
    if (filters.assigneeId) {
      where.assigneeId = { in: filters.assigneeId.split(',') };
    }
    if (filters.reporterId) {
      where.reporterId = { in: filters.reporterId.split(',') };
    }
    if (filters.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }

    const bugs = await this.prisma.bug.findMany({
      where,
      include: BUG_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });

    const ExcelJS = await import('exceljs');
    const Workbook = ExcelJS.default?.Workbook ?? ExcelJS.Workbook;
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Bugs');

    sheet.columns = [
      { header: 'Bug Key', key: 'bugKey', width: 14 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Assignee', key: 'assignee', width: 20 },
      { header: 'Owner', key: 'owner', width: 20 },
      { header: 'Reporter', key: 'reporter', width: 20 },
      { header: 'Environment', key: 'environment', width: 20 },
      { header: 'Preconditions', key: 'preconditions', width: 30 },
      { header: 'Expected Result', key: 'expectedResult', width: 30 },
      { header: 'Actual Result', key: 'actualResult', width: 30 },
      { header: 'Repro Steps', key: 'reproSteps', width: 40 },
      { header: 'Linked Tasks', key: 'linkedTasks', width: 20 },
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

    for (const b of bugs) {
      const reproText = (b.reproSteps ?? [])
        .map((s: any) => `${s.position}. ${s.content}`)
        .join('\n');

      const row = sheet.addRow({
        bugKey: b.bugKey ?? '',
        title: b.title,
        description: b.description ?? '',
        severity: b.severity,
        status: (b as any).workflowStatus?.name ?? '',
        assignee: (b as any).assignee?.name ?? (b as any).assignee?.username ?? '',
        owner: (b as any).owner?.name ?? (b as any).owner?.username ?? '',
        reporter: (b as any).reporter?.name ?? (b as any).reporter?.username ?? '',
        environment: b.environment ?? '',
        preconditions: b.preconditions ?? '',
        expectedResult: b.expectedResult ?? '',
        actualResult: b.actualResult ?? '',
        reproSteps: reproText,
        linkedTasks: ((b as any).bugTasks ?? []).map((bt: any) => bt.task?.taskKey).filter(Boolean).join(', '),
        createdAt: b.createdAt ? new Date(b.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '',
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

  async linkTasks(bugId: string, taskIds: string[]) {
    await this.prisma.bugTask.createMany({
      data: taskIds.map(taskId => ({ bugId, taskId })),
      skipDuplicates: true,
    });
    return this.findOne(bugId);
  }

  async unlinkTask(bugId: string, taskId: string) {
    await this.prisma.bugTask.deleteMany({
      where: { bugId, taskId },
    });
    return this.findOne(bugId);
  }

  async getLinkedTasks(bugId: string) {
    const bugTasks = await this.prisma.bugTask.findMany({
      where: { bugId },
      include: {
        task: { select: { id: true, taskKey: true, title: true } },
      },
    });
    return bugTasks.map(bt => bt.task);
  }

  async createFixTask(bugId: string, projectId: string, creatorId: string, dto: { title?: string; parentId?: string; assigneeId?: string }) {
    const bug = await this.prisma.bug.findUniqueOrThrow({
      where: { id: bugId },
      select: {
        id: true,
        bugKey: true,
        title: true,
        description: true,
        preconditions: true,
        expectedResult: true,
        actualResult: true,
        environment: true,
        severity: true,
        assigneeId: true,
        projectId: true,
        reproSteps: { orderBy: { position: 'asc' } },
      },
    });

    if (bug.projectId !== projectId) {
      throw new Error('Bug does not belong to this project');
    }

    const title = dto.title?.trim() || `Fix [${bug.bugKey}]: ${bug.title}`;

    const sections: string[] = [];
    if (bug.description) sections.push(`**Description:** ${bug.description}`);
    if (bug.preconditions) sections.push(`**Preconditions:** ${bug.preconditions}`);
    if (bug.expectedResult) sections.push(`**Expected Result:** ${bug.expectedResult}`);
    if (bug.actualResult) sections.push(`**Actual Result:** ${bug.actualResult}`);
    if (bug.environment) sections.push(`**Environment:** ${bug.environment}`);
    if (bug.severity) sections.push(`**Severity:** ${bug.severity}`);
    if (bug.reproSteps.length > 0) {
      const steps = bug.reproSteps.map((s, i) => `${i + 1}. ${s.content}`).join('\n');
      sections.push(`**Repro Steps:**\n${steps}`);
    }
    const description = `**Bug:** ${bug.bugKey}\n\n${sections.join('\n\n')}`;

    const task = await this.tasksService.create(projectId, creatorId, {
      title,
      description,
      parentId: dto.parentId,
      assigneeId: dto.assigneeId ?? bug.assigneeId ?? undefined,
    } as any);

    await this.prisma.bugTask.create({
      data: { bugId, taskId: task.id },
    });

    return task;
  }

  async getBugsByTaskId(taskId: string) {
    const bugTasks = await this.prisma.bugTask.findMany({
      where: { taskId },
      include: {
        bug: {
          include: BUG_RELATIONS,
        },
      },
    });
    return bugTasks.map(bt => bt.bug);
  }

  async delete(bugId: string) {
    return this.prisma.bug.delete({ where: { id: bugId } });
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
    const watcherIds = await this.watchersService.getWatcherUserIds('BUG' as EntityType, opts.entityId);
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
      entityType: 'BUG' as EntityType,
      entityId: opts.entityId,
      entityTitle: opts.entityTitle,
      actorId: opts.actorId,
      summary: opts.summary,
      metadata: enrichedMetadata ?? undefined,
    })) as Prisma.NotificationCreateManyInput[];
    await this.notifications.createMany(data);
  }
}
