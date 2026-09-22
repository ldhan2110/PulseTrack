import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembersService } from './members.service';

function makeDeps() {
  const prisma = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    projectMember: {
      create: vi.fn().mockResolvedValue({ id: 'm1', user: { email: 'staff@x.com' } }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    project: { findUnique: vi.fn().mockResolvedValue({ name: 'Proj' }) },
  } as any;
  const notifications = { notifyUser: vi.fn() } as any;
  const auth = {
    issueSetPasswordToken: vi.fn().mockResolvedValue('rawtoken'),
    enqueueSetPasswordEmail: vi.fn(),
  } as any;
  const emailQueue = { add: vi.fn() } as any;
  return { prisma, notifications, auth, emailQueue };
}

describe('MembersService.invite — new email invitee is EXTERNAL (req-6)', () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: MembersService;

  beforeEach(() => {
    deps = makeDeps();
    service = new MembersService(deps.prisma, deps.notifications, deps.auth, deps.emailQueue);
  });

  it('new invitee (not an existing user): creates EXTERNAL/INVITED row + set-password email', async () => {
    deps.prisma.user.findUnique.mockResolvedValue(null);
    deps.prisma.user.create.mockResolvedValue({ id: 'ext1' });

    await service.invite('p1', { email: 'Cust@X.com', roleId: 'r1' });

    const createArg = deps.prisma.user.create.mock.calls[0][0];
    expect(createArg.data.userType).toBe('EXTERNAL');
    expect(createArg.data.status).toBe('INVITED');
    expect(createArg.data.passwordHash).toBeNull();
    expect(deps.auth.issueSetPasswordToken).toHaveBeenCalledWith('ext1', expect.any(Number));
    expect(deps.auth.enqueueSetPasswordEmail).toHaveBeenCalledWith('cust@x.com', 'rawtoken');
    // no Keycloak-pending "invite" email anymore
    expect(deps.emailQueue.add).not.toHaveBeenCalledWith('invite', expect.anything());
  });

  it('existing user: added as a member, no EXTERNAL provisioning', async () => {
    deps.prisma.user.findUnique.mockResolvedValue({ id: 'u9' });
    deps.prisma.projectMember.findUnique.mockResolvedValue(null);

    await service.invite('p1', { email: 'staff@x.com', roleId: 'r1' });

    expect(deps.prisma.user.create).not.toHaveBeenCalled();
    expect(deps.auth.enqueueSetPasswordEmail).not.toHaveBeenCalled();
  });
});
