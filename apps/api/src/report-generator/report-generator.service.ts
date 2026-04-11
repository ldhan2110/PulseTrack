import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ReportTaskData {
  taskKey: string;
  title: string;
  statusName: string;
  progress: number;
}

export interface ReportMemberData {
  name: string;
  avgProgress: number;
  tasks: ReportTaskData[];
}

export interface ReportData {
  projectName: string;
  date: string;
  totalTasks: number;
  totalMembers: number;
  avgProgress: number;
  statusSummary: Record<string, number>;
  members: ReportMemberData[];
}

@Injectable()
export class ReportGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(projectId: string): Promise<ReportData> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        isDraft: false,
        assigneeId: { not: null },
        OR: [
          { progress: { lt: 100 } },
          {
            workflowStatus: { isClosed: true },
            actualEndDate: { gte: today, lt: tomorrow },
          },
        ],
      },
      include: {
        assignee: { select: { id: true, name: true, username: true } },
        workflowStatus: { select: { name: true } },
      },
    });

    const memberMap = new Map<string, { name: string; tasks: ReportTaskData[] }>();
    const statusCounts: Record<string, number> = {};

    for (const task of tasks) {
      if (!task.assignee) continue;

      const memberId = task.assignee.id;
      const memberName = task.assignee.name ?? task.assignee.username;

      if (!memberMap.has(memberId)) {
        memberMap.set(memberId, { name: memberName, tasks: [] });
      }

      const statusName = task.workflowStatus?.name ?? 'No Status';
      statusCounts[statusName] = (statusCounts[statusName] ?? 0) + 1;

      memberMap.get(memberId)!.tasks.push({
        taskKey: task.taskKey ?? task.id.slice(0, 8),
        title: task.title,
        statusName,
        progress: task.progress,
      });
    }

    const members: ReportMemberData[] = Array.from(memberMap.values()).map((m) => ({
      name: m.name,
      avgProgress: m.tasks.length > 0
        ? Math.round(m.tasks.reduce((sum, t) => sum + t.progress, 0) / m.tasks.length)
        : 0,
      tasks: m.tasks,
    }));

    const allProgresses = tasks.map((t) => t.progress);
    const avgProgress = allProgresses.length > 0
      ? Math.round(allProgresses.reduce((a, b) => a + b, 0) / allProgresses.length)
      : 0;

    const dateStr = today.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return {
      projectName: project.name,
      date: dateStr,
      totalTasks: tasks.length,
      totalMembers: members.length,
      avgProgress,
      statusSummary: statusCounts,
      members,
    };
  }

  formatAsMarkdown(report: ReportData): string {
    const lines: string[] = [];
    lines.push(`📊 ${report.projectName} — ${report.date}`);
    lines.push('');
    lines.push('📈 Overview');
    lines.push(`   Tasks: ${report.totalTasks} · Members: ${report.totalMembers} · Avg Progress: ${report.avgProgress}%`);
    lines.push(`   ${Object.entries(report.statusSummary).map(([k, v]) => `${k}: ${v}`).join(' · ')}`);
    lines.push('');

    for (const member of report.members) {
      lines.push(`👤 ${member.name} — Avg: ${member.avgProgress}%`);
      for (const task of member.tasks) {
        lines.push(`   • ${task.taskKey} ${task.title} (${task.statusName}) ${task.progress}%`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  formatAsHtml(report: ReportData): string {
    const statusLine = Object.entries(report.statusSummary)
      .map(([k, v]) => `${k}: <strong>${v}</strong>`)
      .join(' &middot; ');

    const memberSections = report.members
      .map((m) => {
        const taskRows = m.tasks
          .map(
            (t) =>
              `<tr>
                <td style="padding:4px 8px;font-family:monospace;font-size:13px;color:#6366f1">${t.taskKey}</td>
                <td style="padding:4px 8px">${t.title}</td>
                <td style="padding:4px 8px;color:#f59e0b">${t.statusName}</td>
                <td style="padding:4px 8px;text-align:right">
                  <span style="color:#3b82f6;font-weight:600">${t.progress}%</span>
                </td>
              </tr>`,
          )
          .join('');

        return `
          <div style="margin-bottom:20px">
            <h3 style="margin:0 0 8px 0;font-size:15px">👤 ${m.name} — <span style="color:#888">Avg: ${m.avgProgress}%</span></h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              ${taskRows}
            </table>
          </div>`;
      })
      .join('');

    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;color:#e0e0e0;background:#1a1a2e;padding:24px;border-radius:12px">
        <h2 style="margin:0 0 4px 0;font-size:18px">📊 ${report.projectName}</h2>
        <p style="margin:0 0 16px 0;color:#888;font-size:13px">${report.date}</p>
        <div style="background:#16213e;padding:12px 16px;border-radius:8px;margin-bottom:20px">
          <p style="margin:0 0 4px 0;font-weight:600">📈 Overview</p>
          <p style="margin:0;font-size:14px">Tasks: <strong>${report.totalTasks}</strong> &middot; Members: <strong>${report.totalMembers}</strong> &middot; Avg Progress: <strong>${report.avgProgress}%</strong></p>
          <p style="margin:4px 0 0 0;font-size:13px;color:#aaa">${statusLine}</p>
        </div>
        ${memberSections}
        <p style="margin:16px 0 0 0;font-size:11px;color:#666;text-align:center">Generated by PulseTrack</p>
      </div>`;
  }
}
