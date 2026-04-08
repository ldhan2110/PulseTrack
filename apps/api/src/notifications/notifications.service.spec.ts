import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      notification: {
        createMany: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    service = new NotificationsService(prisma);
  });

  it('createMany inserts notifications in bulk', async () => {
    prisma.notification.createMany.mockResolvedValue({ count: 2 });
    const data = [
      { recipientId: 'u1', projectId: 'p1', type: 'STATUS_CHANGE', entityType: 'TASK', entityId: 't1', entityTitle: 'PM-1: Fix', actorId: 'u2', summary: 'Changed status' },
      { recipientId: 'u3', projectId: 'p1', type: 'STATUS_CHANGE', entityType: 'TASK', entityId: 't1', entityTitle: 'PM-1: Fix', actorId: 'u2', summary: 'Changed status' },
    ];
    await service.createMany(data as any);
    expect(prisma.notification.createMany).toHaveBeenCalledWith({ data });
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
