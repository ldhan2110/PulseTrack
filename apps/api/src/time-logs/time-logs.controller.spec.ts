import { vi } from 'vitest';
import { TimeLogsController } from './time-logs.controller';

// ProjectRolesGuard puts the caller's role permissions on req.user.permissions.
// update/remove must forward exactly that object so non-authors with
// tasks:delete (e.g. a PM) can manage other members' time logs.
describe('TimeLogsController', () => {
  const permissions = { tasks: ['read', 'delete'] };
  const req = { user: { id: 'u1', permissions } };

  function make() {
    const service = {
      update: vi.fn(async () => ({ id: 'tl1' })),
      remove: vi.fn(async () => ({ success: true })),
    };
    return { service, controller: new TimeLogsController(service as any) };
  }

  it('update forwards req.user.permissions to the service', async () => {
    const { service, controller } = make();
    const dto = { minutes: 30 };
    await controller.update('p1', 't1', 'tl1', req, dto as any);
    expect(service.update).toHaveBeenCalledWith('p1', 't1', 'tl1', 'u1', permissions, dto);
  });

  it('remove forwards req.user.permissions to the service', async () => {
    const { service, controller } = make();
    await controller.remove('p1', 't1', 'tl1', req);
    expect(service.remove).toHaveBeenCalledWith('p1', 't1', 'tl1', 'u1', permissions);
  });
});
