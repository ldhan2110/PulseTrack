import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService.findAll — directory scoping (req-10)', () => {
  let prisma: any;
  let service: UsersService;

  beforeEach(() => {
    prisma = { user: { findMany: vi.fn().mockResolvedValue([]) } };
    service = new UsersService(prisma, {} as any);
  });

  it('scopes to users sharing a project or conversation with the caller (not global)', async () => {
    await service.findAll('caller1');

    const arg = prisma.user.findMany.mock.calls[0][0];
    // must be a scoped query, never a bare findMany()
    expect(arg?.where).toBeDefined();
    expect(arg.where.id).toEqual({ not: 'caller1' });

    const or = arg.where.OR;
    expect(Array.isArray(or)).toBe(true);
    const json = JSON.stringify(or);
    expect(json).toContain('projectMembers');
    expect(json).toContain('conversationMemberships');
    // the shared-membership predicate is keyed on the caller
    expect(json).toContain('caller1');
  });

  it('a caller sharing nothing gets an empty directory (query returns none)', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const result = await service.findAll('lonely');
    expect(result).toEqual([]);
  });
});

const EXTERNAL = {
  id: 'ext1',
  userType: 'EXTERNAL',
  name: 'Old Name',
  imageUrl: null,
  passwordHash: 'argon-hash',
  pwResetTokenHash: 'tok',
  pwResetTokenExp: new Date(),
  email: 'e@x.com',
};
const INTERNAL = { ...EXTERNAL, id: 'int1', userType: 'INTERNAL' };

function make(prismaUser: any, auth: any = {}) {
  const prisma = { user: prismaUser };
  return new UsersService(prisma as any, auth as any);
}

describe('UsersService.sanitizeUser (req-4)', () => {
  it('strips passwordHash, pwResetTokenHash, pwResetTokenExp', () => {
    const svc = make({});
    const safe = svc.sanitizeUser(EXTERNAL as any) as any;
    expect(safe.passwordHash).toBeUndefined();
    expect(safe.pwResetTokenHash).toBeUndefined();
    expect(safe.pwResetTokenExp).toBeUndefined();
    expect(safe.id).toBe('ext1');
    expect(safe.name).toBe('Old Name');
  });
});

describe('UsersService.updateOwnProfile (req-1)', () => {
  it('external updates name → persisted + sanitized', async () => {
    const update = vi.fn().mockResolvedValue({ ...EXTERNAL, name: 'New' });
    const svc = make({
      findUniqueOrThrow: vi.fn().mockResolvedValue(EXTERNAL),
      update,
    });
    const res = (await svc.updateOwnProfile('ext1', { name: '  New  ' })) as any;
    expect(update).toHaveBeenCalledWith({ where: { id: 'ext1' }, data: { name: 'New' } });
    expect(res.passwordHash).toBeUndefined();
  });

  it('internal → Forbidden', async () => {
    const svc = make({ findUniqueOrThrow: vi.fn().mockResolvedValue(INTERNAL), update: vi.fn() });
    await expect(svc.updateOwnProfile('int1', { name: 'New' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blank name after trim → BadRequest', async () => {
    const svc = make({ findUniqueOrThrow: vi.fn().mockResolvedValue(EXTERNAL), update: vi.fn() });
    await expect(svc.updateOwnProfile('ext1', { name: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('UsersService.updateOwnAvatar (req-2)', () => {
  it('external sets imageUrl → persisted', async () => {
    const update = vi.fn().mockResolvedValue({ ...EXTERNAL, imageUrl: '/api/uploads/avatars/x.png' });
    const svc = make({ findUniqueOrThrow: vi.fn().mockResolvedValue(EXTERNAL), update });
    await svc.updateOwnAvatar('ext1', '/api/uploads/avatars/x.png');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ext1' },
      data: { imageUrl: '/api/uploads/avatars/x.png' },
    });
  });

  it('internal → Forbidden', async () => {
    const svc = make({ findUniqueOrThrow: vi.fn().mockResolvedValue(INTERNAL), update: vi.fn() });
    await expect(svc.updateOwnAvatar('int1', '/x.png')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('UsersService.changeOwnPassword (req-3)', () => {
  it('correct current → hash replaced', async () => {
    const update = vi.fn().mockResolvedValue(EXTERNAL);
    const auth = {
      verifyPassword: vi.fn().mockResolvedValue(true),
      hashPassword: vi.fn().mockResolvedValue('new-hash'),
    };
    const svc = make({ findUniqueOrThrow: vi.fn().mockResolvedValue(EXTERNAL), update }, auth);
    const res = await svc.changeOwnPassword('ext1', {
      currentPassword: 'cur',
      newPassword: 'longenough',
    });
    expect(auth.verifyPassword).toHaveBeenCalledWith('argon-hash', 'cur');
    expect(update).toHaveBeenCalledWith({ where: { id: 'ext1' }, data: { passwordHash: 'new-hash' } });
    expect(res).toEqual({ success: true });
  });

  it('wrong current → Unauthorized, hash unchanged', async () => {
    const update = vi.fn();
    const auth = { verifyPassword: vi.fn().mockResolvedValue(false), hashPassword: vi.fn() };
    const svc = make({ findUniqueOrThrow: vi.fn().mockResolvedValue(EXTERNAL), update }, auth);
    await expect(
      svc.changeOwnPassword('ext1', { currentPassword: 'bad', newPassword: 'longenough' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(update).not.toHaveBeenCalled();
  });

  it('internal → Forbidden', async () => {
    const svc = make(
      { findUniqueOrThrow: vi.fn().mockResolvedValue(INTERNAL), update: vi.fn() },
      { verifyPassword: vi.fn(), hashPassword: vi.fn() },
    );
    await expect(
      svc.changeOwnPassword('int1', { currentPassword: 'x', newPassword: 'longenough' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
