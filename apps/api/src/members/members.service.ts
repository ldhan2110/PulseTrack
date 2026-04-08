import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AddMemberDto } from './dto/add-member.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { ChangeRoleDto } from './dto/change-role.dto';

@Injectable()
export class MembersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(projectId: string) {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, email: true, username: true, name: true, imageUrl: true },
        },
      },
    });
  }

  async addMember(projectId: string, dto: AddMemberDto) {
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this project');
    }

    const member = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        role: dto.role,
      },
      include: {
        user: {
          select: { id: true, email: true, username: true, name: true, imageUrl: true },
        },
      },
    });

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    this.notifications.notifyUser(dto.userId, 'member:added', {
      projectId,
      projectName: project?.name ?? '',
    });

    return member;
  }

  async addMembers(projectId: string, dto: AddMembersDto) {
    const userIds = dto.members.map((m) => m.userId);
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length !== userIds.length) {
      throw new BadRequestException('Duplicate user IDs in request');
    }
    const existing = await this.prisma.projectMember.findMany({
      where: { projectId, userId: { in: userIds } },
      select: { userId: true },
    });

    if (existing.length > 0) {
      const existingIds = existing.map((m) => m.userId);
      throw new ConflictException(
        `Some users are already members of this project: ${existingIds.join(', ')}`,
      );
    }

    const members = await this.prisma.$transaction(
      dto.members.map((entry) =>
        this.prisma.projectMember.create({
          data: {
            projectId,
            userId: entry.userId,
            role: entry.role,
          },
          include: {
            user: {
              select: { id: true, email: true, username: true, name: true, imageUrl: true },
            },
          },
        }),
      ),
    );

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    for (const m of members) {
      this.notifications.notifyUser(m.userId, 'member:added', {
        projectId,
        projectName: project?.name ?? '',
      });
    }

    return members;
  }

  async changeMemberRole(
    projectId: string,
    memberId: string,
    dto: ChangeRoleDto,
  ) {
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    return this.prisma.projectMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: {
          select: { id: true, email: true, username: true, name: true, imageUrl: true },
        },
      },
    });
  }

  async removeMember(projectId: string, memberId: string, actorId: string) {
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      include: {
        user: { select: { id: true, username: true, name: true, imageUrl: true } },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    // Prevent removing the last PM
    if (member.role === 'pm') {
      const pmCount = await this.prisma.projectMember.count({
        where: { projectId, role: 'pm' },
      });

      if (pmCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last PM from a project',
        );
      }
    }

    const userId = member.userId;

    // Interactive transaction: reads and writes in the same transaction boundary
    const { taskCount, subTaskCount, bugCount } = await this.prisma.$transaction(async (tx) => {
      // Query active work inside the transaction
      const activeTasks = await tx.task.findMany({
        where: { projectId, assigneeId: userId, workflowStatus: { isClosed: false } },
        select: { id: true },
      });

      // Unassign active tasks
      const tasksResult = await tx.task.updateMany({
        where: { projectId, assigneeId: userId, workflowStatus: { isClosed: false } },
        data: { assigneeId: null },
      });

      // Unassign active sub-tasks (child tasks within the project)
      const subTasksResult = await tx.task.updateMany({
        where: { projectId, assigneeId: userId, parentId: { not: null }, workflowStatus: { isClosed: false } },
        data: { assigneeId: null },
      });

      // Unassign active bugs
      const bugsResult = await tx.bug.updateMany({
        where: { projectId, assigneeId: userId, workflowStatus: { isClosed: false } },
        data: { assigneeId: null },
      });

      // Record history for each unassigned task
      for (const task of activeTasks) {
        await tx.taskHistory.create({
          data: {
            taskId: task.id,
            actorId,
            field: 'assigneeId',
            oldValue: userId,
            newValue: null,
          },
        });
      }

      // Delete the project member
      await tx.projectMember.delete({ where: { id: memberId } });

      return {
        taskCount: tasksResult.count,
        subTaskCount: subTasksResult.count,
        bugCount: bugsResult.count,
      };
    });

    // Post-transaction notifications
    this.notifications.notifyUser(userId, 'member:removed', { projectId });

    const totalUnassigned = taskCount + subTaskCount + bugCount;
    if (totalUnassigned > 0) {
      const pmMembers = await this.prisma.projectMember.findMany({
        where: { projectId, role: 'pm', userId: { not: actorId } },
        select: { userId: true },
      });

      for (const pm of pmMembers) {
        this.notifications.notifyUser(pm.userId, 'member:removed:tasks-unassigned', {
          projectId,
          memberName: member.user.username,
          tasks: taskCount,
          subTasks: subTaskCount,
          bugs: bugCount,
        });
      }
    }

    this.notifications.notifyProject(projectId, 'member:removed', {
      projectId,
      memberId,
    });
  }

  async searchUsers(projectId: string, query: string) {
    const existing = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    const excludedIds = existing.map((m) => m.userId);

    return this.prisma.user.findMany({
      where: {
        ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}),
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true, username: true, name: true, imageUrl: true },
      take: 20,
    });
  }

  async getActiveWork(projectId: string, memberId: string) {
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    const [tasks, subTasks, bugs] = await Promise.all([
      this.prisma.task.count({
        where: {
          projectId,
          assigneeId: member.userId,
          workflowStatus: { isClosed: false },
        },
      }),
      this.prisma.task.count({
        where: {
          projectId,
          assigneeId: member.userId,
          parentId: { not: null },
          workflowStatus: { isClosed: false },
        },
      }),
      this.prisma.bug.count({
        where: {
          projectId,
          assigneeId: member.userId,
          status: { notIn: ['FIXED', 'VERIFIED', 'CLOSED'] },
        },
      }),
    ]);

    return { tasks, subTasks, bugs };
  }
}
