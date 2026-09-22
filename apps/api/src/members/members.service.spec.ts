import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembersService } from './members.service';

function makeDeps() {
  const prisma = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    projectMember: { create: vi.fn().mockResolvedValue({ id: 'm1' }) },
    project: { findUnique: vi.fn().mockResolvedValue({ name: 'Proj' }) },
  } as any;
  const notifications = {} as any;
  const auth = {
    issueSetPasswordToken: vi.fn().mockResolvedValue('rawtoken'),
    enqueueSetPasswordEmail: vi.fn(),
  } as any;
  const emailQueue = { add: vi.fn() } as any;
  return { prisma, notifications, auth, emailQueue };
}

describe('MembersService.invite — external branch (req-6)', () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: MembersService;

  beforeEach(() => {
    deps = makeDeps();
    service = new MembersService(deps.prisma, deps.notifications, deps.auth, deps.emailQueue);
  });

  it('external invite: creates EXTERNAL/INVITED row + enqueues set-password email', async () => {
    deps.prisma.user.findUnique.mockResolvedValue(null);
    deps.prisma.user.create.mockResolvedValue({ id: 'ext1' });

    await service.invite('p1', { email: 'Cust@X.com', roleId: 'r1', external: true });

    const createArg = deps.prisma.user.create.mock.calls[0][0];
    expect(createArg.data.userType).toBe('EXTERNAL');
    expect(createArg.data.status).toBe('INVITED');
    expect(createArg.data.passwordHash).toBeNull();
    expect(deps.auth.issueSetPasswordToken).toHaveBeenCalledWith('ext1', expect.any(Number));
    expect(deps.auth.enqueueSetPasswordEmail).toHaveBeenCalledWith('cust@x.com', 'rawtoken');
    // not the Keycloak "invite" email
    expect(deps.emailQueue.add).not.toHaveBeenCalledWith('invite', expect.anything());
  });

  it('internal invite path unchanged: pending row + Keycloak invite email', async () => {
    deps.prisma.user.findUnique.mockResolvedValue(null);
    deps.prisma.user.create.mockResolvedValue({ id: 'int1' });

    await service.invite('p1', { email: 'staff@x.com', roleId: 'r1' });

    const createArg = deps.prisma.user.create.mock.calls[0][0];
    expect(createArg.data.userType).toBeUndefined(); // defaults to INTERNAL at the DB
    expect(deps.emailQueue.add).toHaveBeenCalledWith('invite', expect.objectContaining({ email: 'staff@x.com' }));
    expect(deps.auth.enqueueSetPasswordEmail).not.toHaveBeenCalled();
  });
});
