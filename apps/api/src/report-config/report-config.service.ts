import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertReportConfigDto } from './dto/upsert-report-config.dto';
import { encrypt, decrypt, maskToken } from '../common/encryption.util';

@Injectable()
export class ReportConfigService {
  private readonly logger = new Logger(ReportConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('report-generation') private readonly reportQueue: Queue,
  ) {}

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
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.googleChatWebhookUrl) {
      data.googleChatWebhookUrl = encrypt(dto.googleChatWebhookUrl, this.encryptionKey);
    }

    const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const config = await this.prisma.reportConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        timezone: serverTimezone,
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
    return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  private async syncSchedule(
    configId: string,
    config: { isActive: boolean; frequency: string; scheduleDays: number[]; scheduleTime: string; timezone: string; bullmqJobId: string | null },
  ) {
    if (config.bullmqJobId) {
      try {
        const removed = await this.reportQueue.removeRepeatableByKey(config.bullmqJobId);
        if (!removed) {
          this.logger.warn(`Could not remove repeatable job key: ${config.bullmqJobId}`);
        }
      } catch (err) {
        this.logger.warn(`Error removing repeatable job: ${err}`);
      }
    }

    if (!config.isActive) {
      await this.prisma.reportConfig.update({
        where: { id: configId },
        data: { bullmqJobId: null },
      });
      return;
    }

    const cron = this.buildCron(config.frequency, config.scheduleDays, config.scheduleTime);

    const job = await this.reportQueue.add(
      'generate-report',
      { reportConfigId: configId },
      {
        repeat: { pattern: cron, tz: config.timezone },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    const repeatJobKey = job.repeatJobKey;

    await this.prisma.reportConfig.update({
      where: { id: configId },
      data: { bullmqJobId: repeatJobKey ?? null },
    });
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
