import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationEmailService } from './notification-email.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Processor('notification-email', { concurrency: 5 })
export class NotificationEmailProcessor extends WorkerHost {
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private emailService: NotificationEmailService,
    private config: ConfigService,
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

  async process(job: Job<{ notificationId: string; recipientEmail: string; recipientName: string }>) {
    const { notificationId, recipientEmail } = job.data;

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        actor: { select: { name: true, username: true } },
        project: { select: { prefix: true } },
      },
    });

    if (!notification) return;

    const actorName = notification.actor.name ?? notification.actor.username;
    const appUrl = this.config.get('APP_URL', 'http://localhost:5173');
    const prefix = notification.project.prefix ?? '';
    const entityPath = notification.entityType === 'TASK'
      ? `projects/${prefix}/tasks/${notification.entityId}`
      : `projects/${prefix}/bugs/${notification.entityId}`;
    const viewUrl = `${appUrl}/${entityPath}`;
    const reason = notification.type === 'MENTION'
      ? 'You are receiving this because you were mentioned in a comment.'
      : 'You are receiving this because you are watching this ticket.';

    const html = this.emailService.renderEmailHtml({
      entityTitle: notification.entityTitle,
      summary: notification.summary,
      actorName,
      viewUrl,
      reason,
    });

    const subject = this.emailService.renderSubject(notification.entityTitle);
    const from = this.config.get('SMTP_FROM', 'PulseTrack <noreply@pulsetrack.com>');

    await this.transporter.sendMail({ from, to: recipientEmail, subject, html });
  }
}
