import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GlobalSearchResult {
  projects: {
    id: string;
    name: string;
    prefix: string | null;
    avatarUrl: string | null;
  }[];
  tasks: {
    id: string;
    taskKey: string | null;
    title: string;
    projectPrefix: string | null;
    projectName: string;
    statusName: string | null;
  }[];
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, q: string): Promise<GlobalSearchResult> {
    const term = q.trim();
    if (!term) return { projects: [], tasks: [] };

    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const myProjectIds = memberships.map((m) => m.projectId);
    if (myProjectIds.length === 0) return { projects: [], tasks: [] };

    const [projects, tasks] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          id: { in: myProjectIds },
          archived: false,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { prefix: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 10,
      }),
      this.prisma.task.findMany({
        where: {
          projectId: { in: myProjectIds },
          isDraft: false,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { taskKey: { contains: term, mode: 'insensitive' } },
          ],
        },
        include: {
          project: { select: { name: true, prefix: true } },
          workflowStatus: { select: { name: true } },
        },
        take: 20,
      }),
    ]);

    const lower = term.toLowerCase();
    const orderedTasks = tasks
      .map((t) => ({
        id: t.id,
        taskKey: t.taskKey,
        title: t.title,
        projectPrefix: t.project.prefix,
        projectName: t.project.name,
        statusName: t.workflowStatus?.name ?? null,
        _exact: (t.taskKey ?? '').toLowerCase() === lower,
      }))
      .sort((a, b) => Number(b._exact) - Number(a._exact))
      .map(({ _exact, ...rest }) => rest);

    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        prefix: p.prefix,
        avatarUrl: p.avatarUrl,
      })),
      tasks: orderedTasks,
    };
  }
}
