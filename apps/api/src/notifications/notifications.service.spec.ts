import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let emailQueue: any;

  beforeEach(() => {
    prisma = {
      notification: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      project: { findUnique: vi.fn() },
      user: { findMany: vi.fn() },
    };
    emailQueue = { add: vi.fn() };
    service = new NotificationsService(prisma, emailQueue);
  });

  it('createMany inserts notifications individually and enqueues emails', async () => {
    const n1 = { id: 'n1', recipientId: 'u1', projectId: 'p1' };
    const n2 = { id: 'n2', recipientId: 'u3', projectId: 'p1' };
    prisma.notification.create.mockResolvedValueOnce(n1).mockResolvedValueOnce(n2);
    prisma.project.findUnique.mockResolvedValue({ emailNotificationsEnabled: true });
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'u1@test.com', name: 'User1', username: 'user1' },
      { id: 'u3', email: 'u3@test.com', name: 'User3', username: 'user3' },
    ]);
    const data = [
      { recipientId: 'u1', projectId: 'p1', type: 'STATUS_CHANGE', entityType: 'TASK', entityId: 't1', entityTitle: 'PM-1: Fix', actorId: 'u2', summary: 'Changed status' },
      { recipientId: 'u3', projectId: 'p1', type: 'STATUS_CHANGE', entityType: 'TASK', entityId: 't1', entityTitle: 'PM-1: Fix', actorId: 'u2', summary: 'Changed status' },
    ];
    await service.createMany(data as any);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(emailQueue.add).toHaveBeenCalledTimes(2);
    expect(emailQueue.add).toHaveBeenCalledWith('send', { notificationId: 'n1', recipientEmail: 'u1@test.com', recipientName: 'User1' });
  });

  it('getUnreadCount returns count for user', async () => {
    prisma.notification.count.mockResolvedValue(5);
    const count = await service.getUnreadCount('u1');
    expect(count).toBe(5);
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { recipientId: 'u1', isRead: false },
    });
  });

  it('markAsRead updates single notification', async () => {
    prisma.notification.update.mockResolvedValue({ id: 'n1', isRead: true });
    await service.markAsRead('n1', 'u1');
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });

  it('markAllAsRead updates all unread for user', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    await service.markAllAsRead('u1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { recipientId: 'u1', isRead: false },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });
});
