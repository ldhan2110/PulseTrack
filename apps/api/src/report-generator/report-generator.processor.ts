import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ReportGeneratorService, ReportData } from './report-generator.service';
import { GoogleChatService } from './google-chat.service';
import { decrypt } from '../common/encryption.util';
import * as nodemailer from 'nodemailer';

@Processor('report-generation', { concurrency: 3 })
export class ReportGeneratorProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportGeneratorProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly reportGenerator: ReportGeneratorService,
    private readonly googleChat: GoogleChatService,
  ) {
    super();
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: parseInt(this.config.get('SMTP_PORT', '587'), 10),
      secure: this.config.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
  }

  async process(job: Job<{ reportConfigId: string }>) {
    const { reportConfigId } = job.data;
    this.logger.log(`Processing report for config: ${reportConfigId}`);

    const reportConfig = await this.prisma.reportConfig.findUnique({
      where: { id: reportConfigId },
      include: { project: { select: { id: true, name: true } } },
    });

    if (!reportConfig || !reportConfig.isActive) {
      this.logger.warn(`Report config ${reportConfigId} not found or inactive`);
      return;
    }

    const report = await this.reportGenerator.generate(reportConfig.projectId);

    if (report.totalTasks === 0) {
      this.logger.log(`No tasks to report for project: ${reportConfig.project.name}`);
      return;
    }

    const reportType = reportConfig.frequency === 'weekly' ? 'weekly' : 'daily';
    await this.prisma.report.create({
      data: {
        type: reportType,
        content: this.reportGenerator.formatAsMarkdown(report),
        projectId: reportConfig.projectId,
      },
    });

    if (reportConfig.emailEnabled) {
      await this.deliverEmail(reportConfig, report);
    }

    if (reportConfig.googleChatEnabled && reportConfig.googleChatWebhookUrl) {
      const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
      const webhookUrl = decrypt(reportConfig.googleChatWebhookUrl, encryptionKey);
      await this.googleChat.send(webhookUrl, report);
    }

    this.logger.log(`Report delivered for project: ${reportConfig.project.name}`);
  }

  private async deliverEmail(
    reportConfig: {
      projectId: string;
      recipientMode: string;
      recipientRoles: string[];
      recipientMembers: string[];
      project: { id: string; name: string };
    },
    report: ReportData,
  ) {
    const recipients = await this.resolveRecipients(
      reportConfig.projectId,
      reportConfig.recipientMode,
      reportConfig.recipientRoles,
      reportConfig.recipientMembers,
    );

    const html = this.reportGenerator.formatAsHtml(report);
    const subject = `📊 ${reportConfig.project.name} — ${report.date} Report`;

    for (const recipient of recipients) {
      await this.sendEmail(recipient.email, subject, html);
    }
  }

  private async resolveRecipients(
    projectId: string,
    mode: string,
    roleIds: string[],
    memberIds: string[],
  ): Promise<{ email: string; name: string }[]> {
    let where: Record<string, unknown> = { projectId };

    if (mode === 'roles' && roleIds.length > 0) {
      where = { ...where, roleId: { in: roleIds } };
    } else if (mode === 'members' && memberIds.length > 0) {
      where = { ...where, id: { in: memberIds } };
    }

    const members = await this.prisma.projectMember.findMany({
      where,
      include: {
        user: { select: { email: true, name: true, username: true } },
      },
    });

    return members.map((m) => ({
      email: m.user.email,
      name: m.user.name ?? m.user.username,
    }));
  }

  private async sendEmail(to: string, subject: string, html: string) {
    try {
      const from = this.config.get('SMTP_FROM', 'PulseTrack <noreply@pulsetrack.com>');
      await this.transporter.sendMail({ from, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send report email to ${to}: ${err}`);
    }
  }
}
