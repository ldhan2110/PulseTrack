import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationEmailService } from './notification-email.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Processor('notification-email', { concurrency: 5 })
export class NotificationEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationEmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private emailService: NotificationEmailService,
    private config: ConfigService,
  ) {
    super();
    const smtpHost = this.config.get('SMTP_HOST');
    const smtpPort = parseInt(this.config.get('SMTP_PORT', '587'), 10);
    const smtpSecure = this.config.get('SMTP_SECURE') === 'true';
    const smtpUser = this.config.get('SMTP_USER');

    this.logger.log(`SMTP config: host=${smtpHost} port=${smtpPort} secure=${smtpSecure} auth=${smtpUser ? 'yes' : 'no (relay mode)'}`);

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      requireTLS: true,
      name: "cyberlogitec.com",
      tls: {
        ca: require("fs").readFileSync("/etc/ssl/certs/ca-certificates.crt"),
      },
      ...(smtpUser ? { auth: { user: smtpUser, pass: this.config.get('SMTP_PASS') } } : {}),
    });
  }

  async process(job: Job<{ notificationId: string; recipientEmail: string; recipientName: string }>) {
    const { notificationId, recipientEmail } = job.data;
    this.logger.log(`Processing job ${job.id} | notificationId=${notificationId} | to=${recipientEmail}`);

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        actor: { select: { name: true, username: true } },
        project: { select: { prefix: true } },
      },
    });

    if (!notification) {
      this.logger.warn(`Notification ${notificationId} not found, skipping`);
      return;
    }

    const actorName = notification.actor.name ?? notification.actor.username;
    const appUrl = this.config.get('APP_URL', 'http://localhost:5173');
    const prefix = notification.project.prefix ?? '';
    const meta = (notification.metadata as Record<string, unknown>) ?? {};
    const entityKey = (meta.entityKey as string) ?? notification.entityId;
    const entityPath = notification.entityType === 'TASK'
      ? `projects/${prefix}/tasks/${entityKey}`
      : `projects/${prefix}/bugs/${entityKey}`;
    const viewUrl = `${appUrl}/${entityPath}`;
    const reasonMap: Record<string, string> = {
      MENTION: 'You are receiving this because you were mentioned in a comment.',
      ASSIGNEE_CHANGE: 'You are receiving this because you were assigned to this ticket.',
    };
    const reason = reasonMap[notification.type] ?? 'You are receiving this because you are watching this ticket.';

    const html = this.emailService.renderEmailHtml({
      entityTitle: notification.entityTitle,
      summary: notification.summary,
      actorName,
      viewUrl,
      reason,
    });

    const subject = this.emailService.renderSubject(notification.entityTitle);
    const from = this.config.get('SMTP_FROM', 'PulseTrack <noreply@pulsetrack.com>');

    this.logger.log(`Sending | from=${from} | to=${recipientEmail} | subject=${subject}`);
    try {
      const info = await this.transporter.sendMail({ from, to: recipientEmail, subject, html });
      this.logger.log(`Sent successfully | messageId=${info.messageId}`);
    } catch (err) {
      this.logger.error(
        `Failed to send email | to=${recipientEmail} | subject=${subject} | ` +
        `smtpHost=${this.config.get('SMTP_HOST')} | smtpPort=${this.config.get('SMTP_PORT')} | ` +
        `error=${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}
