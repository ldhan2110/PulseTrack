import { Injectable, Logger } from '@nestjs/common';

interface ReportMemberData {
  name: string;
  avgProgress: number;
  tasks: { taskKey: string; title: string; statusName: string; progress: number }[];
}

interface ReportData {
  projectName: string;
  date: string;
  totalTasks: number;
  totalMembers: number;
  avgProgress: number;
  statusSummary: Record<string, number>;
  members: ReportMemberData[];
}

@Injectable()
export class GoogleChatService {
  private readonly logger = new Logger(GoogleChatService.name);

  async send(webhookUrl: string, report: ReportData): Promise<void> {
    const sections = [
      {
        header: `📊 ${report.projectName} — ${report.date}`,
        widgets: [
          {
            textParagraph: {
              text: `<b>📈 Overview</b>\nTasks: ${report.totalTasks} · Members: ${report.totalMembers} · Avg Progress: ${report.avgProgress}%\n${Object.entries(report.statusSummary).map(([k, v]) => `${k}: ${v}`).join(' · ')}`,
            },
          },
        ],
      },
      ...report.members.map((member) => ({
        header: `👤 ${member.name} — Avg: ${member.avgProgress}%`,
        widgets: [
          {
            textParagraph: {
              text: member.tasks
                .map((t) => `• <b>${t.taskKey}</b> ${t.title} (${t.statusName}) ${t.progress}%`)
                .join('\n'),
            },
          },
        ],
      })),
    ];

    const body = {
      cardsV2: [
        {
          cardId: 'report',
          card: { sections },
        },
      ],
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Google Chat webhook failed: ${res.status} ${text}`);
      }
    } catch (err) {
      this.logger.error(`Google Chat webhook error: ${err}`);
    }
  }
}
