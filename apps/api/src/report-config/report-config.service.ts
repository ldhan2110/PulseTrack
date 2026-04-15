import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertReportConfigDto } from './dto/upsert-report-config.dto';
import { encrypt, decrypt, maskToken } from '../common/encryption.util';
import { ReportGeneratorService } from '../report-generator/report-generator.service';
import { GoogleChatService } from '../report-generator/google-chat.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ReportConfigService implements OnModuleInit {
  private readonly logger = new Logger(ReportConfigService.name);
  private static readonly SERVER_TIMEZONE = 'Asia/Ho_Chi_Minh';
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('report-generation') private readonly reportQueue: Queue,
    private readonly reportGenerator: ReportGeneratorService,
    private readonly googleChat: GoogleChatService,
  ) {
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

  async onModuleInit() {
    this.logger.log('Re-syncing all active report schedulers...');

    const activeConfigs = await this.prisma.reportConfig.findMany({
      where: { isActive: true },
    });

    for (const config of activeConfigs) {
      try {
        await this.syncSchedule(config.id, config);
        this.logger.log(`Re-synced scheduler for config ${config.id}`);
      } catch (err) {
        this.logger.error(`Failed to re-sync scheduler for config ${config.id}: ${err}`);
      }
    }

    this.logger.log(`Re-synced ${activeConfigs.length} active report scheduler(s)`);
  }

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  async findByProjectId(projectId: string) {
    const config = await this.prisma.reportConfig.findUnique({
      where: { projectId },
    });
    if (!config) return null;
    return {
      ...config,
      googleChatWebhookUrl: config.googleChatWebhookUrl
        ? maskToken(decrypt(config.googleChatWebhookUrl, this.encryptionKey))
        : null,
    };
  }

  async upsert(projectId: string, dto: UpsertReportConfigDto) {
    const data: Record<string, unknown> = {};

    if (dto.emailEnabled !== undefined) data.emailEnabled = dto.emailEnabled;
    if (dto.googleChatEnabled !== undefined) data.googleChatEnabled = dto.googleChatEnabled;
    if (dto.recipientMode !== undefined) data.recipientMode = dto.recipientMode;
    if (dto.recipientRoles !== undefined) data.recipientRoles = dto.recipientRoles;
    if (dto.recipientMembers !== undefined) data.recipientMembers = dto.recipientMembers;
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.scheduleDays !== undefined) data.scheduleDays = dto.scheduleDays;
    if (dto.scheduleTime !== undefined) data.scheduleTime = dto.scheduleTime;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.googleChatWebhookUrl) {
      data.googleChatWebhookUrl = encrypt(dto.googleChatWebhookUrl, this.encryptionKey);
    }

    // Always use the server timezone — ensures BullMQ cron fires at the correct local time
    const serverTimezone = ReportConfigService.SERVER_TIMEZONE;
    data.timezone = serverTimezone;

    const config = await this.prisma.reportConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        ...data,
      },
      update: data,
    });

    await this.syncSchedule(config.id, config);

    return {
      ...config,
      googleChatWebhookUrl: config.googleChatWebhookUrl
        ? maskToken(decrypt(config.googleChatWebhookUrl, this.encryptionKey))
        : null,
    };
  }

  async getServerTimezone() {
    return { timezone: ReportConfigService.SERVER_TIMEZONE };
  }

  async testReport(projectId: string) {
    const reportConfig = await this.prisma.reportConfig.findUnique({
      where: { projectId },
      include: { project: { select: { id: true, name: true } } },
    });

    if (!reportConfig) {
      throw new BadRequestException('Save report settings first before testing');
    }

    if (!reportConfig.emailEnabled && !reportConfig.googleChatEnabled) {
      throw new BadRequestException('Enable at least one channel (Email or Google Chat) before testing');
    }

    const report = await this.reportGenerator.generate(projectId, reportConfig.timezone);

    const results: { channel: string; status: string; detail?: string }[] = [];

    // Email delivery
    if (reportConfig.emailEnabled) {
      try {
        const recipients = await this.resolveRecipients(
          projectId,
          reportConfig.recipientMode,
          reportConfig.recipientRoles,
          reportConfig.recipientMembers,
        );

        if (recipients.length === 0) {
          results.push({ channel: 'email', status: 'skipped', detail: 'No recipients found' });
        } else {
          const html = this.reportGenerator.formatAsHtml(report);
          const subject = `[TEST] 📊 ${reportConfig.project.name} — ${report.date} Report`;
          const from = this.config.get('SMTP_FROM', 'PulseTrack <noreply@pulsetrack.com>');

          for (const recipient of recipients) {
            await this.transporter.sendMail({ from, to: recipient.email, subject, html });
          }
          results.push({ channel: 'email', status: 'sent', detail: `Sent to ${recipients.length} recipient(s)` });
        }
      } catch (err) {
        results.push({ channel: 'email', status: 'failed', detail: String(err) });
      }
    }

    // Google Chat delivery
    if (reportConfig.googleChatEnabled && reportConfig.googleChatWebhookUrl) {
      try {
        const webhookUrl = decrypt(reportConfig.googleChatWebhookUrl, this.encryptionKey);
        await this.googleChat.send(webhookUrl, report);
        results.push({ channel: 'google_chat', status: 'sent' });
      } catch (err) {
        results.push({ channel: 'google_chat', status: 'failed', detail: String(err) });
      }
    }

    return { report: { totalTasks: report.totalTasks, totalMembers: report.totalMembers }, results };
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

  private async syncSchedule(
    configId: string,
    config: { isActive: boolean; frequency: string; scheduleDays: number[]; scheduleTime: string; timezone: string },
  ) {
    const schedulerId = `report-${configId}`;

    if (!config.isActive) {
      try {
        await this.reportQueue.removeJobScheduler(schedulerId);
      } catch (err) {
        this.logger.warn(`Error removing job scheduler ${schedulerId}: ${err}`);
      }
      return;
    }

    const cron = this.buildCron(config.frequency, config.scheduleDays, config.scheduleTime);

    this.logger.log(`Upserting job scheduler ${schedulerId} with cron="${cron}" tz="${config.timezone}"`);

    await this.reportQueue.upsertJobScheduler(
      schedulerId,
      { pattern: cron, tz: config.timezone },
      {
        name: 'generate-report',
        data: { reportConfigId: configId },
        opts: { removeOnComplete: 100, removeOnFail: 50 },
      },
    );

    this.logger.log(`Job scheduler ${schedulerId} upserted successfully`);
  }

  private buildCron(frequency: string, days: number[], time: string): string {
    const [hour, minute] = time.split(':');
    switch (frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`;
      case 'weekly':
        return `${minute} ${hour} * * ${days.length > 0 ? days[0] : 1}`;
      case 'custom':
        return `${minute} ${hour} * * ${days.join(',')}`;
      default:
        return `${minute} ${hour} * * *`;
    }
  }
}
