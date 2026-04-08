import { describe, it, expect } from 'vitest';
import { NotificationEmailService } from './notification-email.service';

describe('NotificationEmailService', () => {
  it('renderEmailHtml produces valid HTML with PulseTrack branding', () => {
    const service = new NotificationEmailService();
    const html = service.renderEmailHtml({
      entityTitle: 'PM-42: Fix login bug',
      summary: 'John Smith changed status from "To Do" to "In Progress"',
      actorName: 'John Smith',
      viewUrl: 'http://localhost:3000/projects/PM/tasks/PM-42',
      reason: 'You are receiving this because you are watching this ticket.',
    });
    expect(html).toContain('PM-42: Fix login bug');
    expect(html).toContain('John Smith changed status');
    expect(html).toContain('View in PulseTrack');
    expect(html).toContain('PulseTrack');
    expect(html).toContain('watching this ticket');
  });

  it('renderSubject formats correctly', () => {
    const service = new NotificationEmailService();
    const subject = service.renderSubject('PM-42: Fix login bug');
    expect(subject).toBe('[PM-42: Fix login bug]');
  });
});
