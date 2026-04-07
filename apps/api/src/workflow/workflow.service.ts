import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveWorkflowDto } from './dto/save-workflow.dto';

const DEFAULT_STATUSES = [
  { key: 'BACKLOG', name: 'Backlog', color: '#6b7280', position: 0, isDefault: true, isClosed: false },
  { key: 'IN_PROGRESS', name: 'In Progress', color: '#3b82f6', position: 1, isDefault: false, isClosed: false },
  { key: 'IN_REVIEW', name: 'In Review', color: '#f59e0b', position: 2, isDefault: false, isClosed: false },
  { key: 'DONE', name: 'Done', color: '#22c55e', position: 3, isDefault: false, isClosed: true },
  { key: 'BLOCKED', name: 'Blocked', color: '#ef4444', position: 4, isDefault: false, isClosed: false },
];

const DEFAULT_TRANSITIONS: [string, string][] = [
  ['BACKLOG', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'BACKLOG'],
  ['IN_PROGRESS', 'IN_REVIEW'],
  ['IN_REVIEW', 'IN_PROGRESS'],
  ['IN_REVIEW', 'DONE'],
  ['DONE', 'IN_REVIEW'],
  ['BACKLOG', 'BLOCKED'],
  ['IN_PROGRESS', 'BLOCKED'],
  ['IN_REVIEW', 'BLOCKED'],
  ['DONE', 'BLOCKED'],
  ['BLOCKED', 'BACKLOG'],
  ['BLOCKED', 'IN_PROGRESS'],
  ['BLOCKED', 'IN_REVIEW'],
];

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  async getWorkflow(projectId: string) {
    const [statuses, transitions, assigneeRules, project] = await Promise.all([
      this.prisma.workflowStatus.findMany({
        where: { projectId },
        orderBy: { position: 'asc' },
      }),
      this.prisma.workflowTransition.findMany({
        where: { projectId },
        include: {
          fromStatus: { select: { key: true } },
          toStatus: { select: { key: true } },
        },
      }),
      this.prisma.statusAssigneeRule.findMany({
        where: { status: { projectId } },
        include: {
          member: {
            include: {
              user: { select: { id: true, username: true, email: true } },
            },
          },
        },
      }),
      this.prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { workflowLayout: true },
      }),
    ]);

    const rulesByStatusId: Record<string, { memberId: string; userId: string; username: string; email: string }[]> = {};
    for (const rule of assigneeRules) {
      if (!rulesByStatusId[rule.statusId]) rulesByStatusId[rule.statusId] = [];
      rulesByStatusId[rule.statusId].push({
        memberId: rule.memberId,
        userId: rule.member.user.id,
        username: rule.member.user.username,
        email: rule.member.user.email,
      });
    }

    return {
      statuses,
      transitions: transitions.map((t) => ({
        id: t.id,
        fromStatusKey: t.fromStatus.key,
        toStatusKey: t.toStatus.key,
        fromStatusId: t.fromStatusId,
        toStatusId: t.toStatusId,
      })),
      assigneeRules: rulesByStatusId,
      layout: project.workflowLayout,
    };
  }

  async saveWorkflow(projectId: string, dto: SaveWorkflowDto) {
    const defaultCount = dto.statuses.filter((s) => s.isDefault).length;
    if (defaultCount !== 1) {
      throw new BadRequestException('Exactly one status must be marked as default');
    }

    const closedCount = dto.statuses.filter((s) => s.isClosed).length;
    if (closedCount < 1) {
      throw new BadRequestException('At least one status must be marked as closed');
    }

    const keys = dto.statuses.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Duplicate status keys are not allowed');
    }

    for (const t of dto.transitions) {
      if (!keys.includes(t.fromStatusKey) || !keys.includes(t.toStatusKey)) {
        throw new BadRequestException(`Transition references unknown status key: ${t.fromStatusKey} → ${t.toStatusKey}`);
      }
    }

    for (const rule of dto.assigneeRules) {
      if (!keys.includes(rule.statusKey)) {
        throw new BadRequestException(`Assignee rule references unknown status key: ${rule.statusKey}`);
      }
    }

    for (const s of dto.statuses) {
      const hasField = s.autoDateField != null;
      const hasAction = s.autoDateAction != null;
      if (hasField !== hasAction) {
        throw new BadRequestException(
          `Status "${s.name}": autoDateField and autoDateAction must both be set or both be null`,
        );
      }
    }

    const allMemberIds = dto.assigneeRules.flatMap((r) => r.memberIds);
    if (allMemberIds.length > 0) {
      const validMembers = await this.prisma.projectMember.findMany({
        where: { projectId, id: { in: allMemberIds } },
        select: { id: true },
      });
      const validIds = new Set(validMembers.map((m) => m.id));
      const invalid = allMemberIds.filter((id) => !validIds.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException(`Invalid member IDs: ${invalid.join(', ')}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const existingStatuses = await tx.workflowStatus.findMany({
        where: { projectId },
        select: { id: true },
      });
      const existingIds = existingStatuses.map((s) => s.id);
      const keptIds = dto.statuses.filter((s) => s.id).map((s) => s.id!);
      const removedIds = existingIds.filter((id) => !keptIds.includes(id));

      if (removedIds.length > 0) {
        await tx.task.updateMany({
          where: { workflowStatusId: { in: removedIds } },
          data: { workflowStatusId: null },
        });
        // Sub-tasks are now child Task records — already covered by the task.updateMany above
      }

      await tx.statusAssigneeRule.deleteMany({
        where: { status: { projectId } },
      });
      await tx.workflowTransition.deleteMany({ where: { projectId } });
      await tx.workflowStatus.deleteMany({ where: { projectId } });

      const statusMap: Record<string, string> = {};
      for (const s of dto.statuses) {
        const created = await tx.workflowStatus.create({
          data: {
            projectId,
            name: s.name,
            key: s.key,
            color: s.color,
            position: s.position,
            isDefault: s.isDefault,
            isClosed: s.isClosed,
            autoDateField: s.autoDateField ?? null,
            autoDateAction: s.autoDateAction ?? null,
          },
        });
        statusMap[s.key] = created.id;
      }

      for (const t of dto.transitions) {
        await tx.workflowTransition.create({
          data: {
            projectId,
            fromStatusId: statusMap[t.fromStatusKey],
            toStatusId: statusMap[t.toStatusKey],
          },
        });
      }

      for (const rule of dto.assigneeRules) {
        for (const memberId of rule.memberIds) {
          await tx.statusAssigneeRule.create({
            data: {
              statusId: statusMap[rule.statusKey],
              memberId,
            },
          });
        }
      }

      await tx.project.update({
        where: { id: projectId },
        data: { workflowLayout: dto.layout ? (dto.layout as any) : undefined },
      });

      return this.getWorkflowFromTx(tx, projectId);
    });
  }

  private async getWorkflowFromTx(tx: any, projectId: string) {
    const statuses = await tx.workflowStatus.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
    return { statuses };
  }

  async seedDefaultWorkflow(projectId: string) {
    const existing = await this.prisma.workflowStatus.count({ where: { projectId } });
    if (existing > 0) return;

    await this.prisma.$transaction(async (tx) => {
      const statusMap: Record<string, string> = {};
      for (const s of DEFAULT_STATUSES) {
        const created = await tx.workflowStatus.create({
          data: { projectId, ...s },
        });
        statusMap[s.key] = created.id;
      }
      for (const [from, to] of DEFAULT_TRANSITIONS) {
        await tx.workflowTransition.create({
          data: {
            projectId,
            fromStatusId: statusMap[from],
            toStatusId: statusMap[to],
          },
        });
      }
    });
  }

  async getAllowedAssignees(projectId: string, statusId: string) {
    const rules = await this.prisma.statusAssigneeRule.findMany({
      where: { statusId },
      include: {
        member: {
          include: {
            user: { select: { id: true, username: true, email: true } },
          },
        },
      },
    });

    if (rules.length === 0) {
      const members = await this.prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: { select: { id: true, username: true, email: true } },
        },
      });
      return members.map((m) => ({
        memberId: m.id,
        userId: m.user.id,
        username: m.user.username,
        email: m.user.email,
      }));
    }

    return rules.map((r) => ({
      memberId: r.memberId,
      userId: r.member.user.id,
      username: r.member.user.username,
      email: r.member.user.email,
    }));
  }

  async getValidTransitions(projectId: string, fromStatusId: string) {
    const transitions = await this.prisma.workflowTransition.findMany({
      where: { projectId, fromStatusId },
      include: {
        toStatus: true,
      },
    });
    return transitions.map((t) => t.toStatus);
  }
}
