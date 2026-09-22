import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

const SECRET = 'test-external-secret';

function makeConfig() {
  return {
    get: vi.fn((k: string) => {
      if (k === 'EXTERNAL_JWT_SECRET') return SECRET;
      if (k === 'APP_URL') return 'http://localhost:5173';
      return undefined;
    }),
  } as any;
}

function makeService(prisma: any, queue: any = { add: vi.fn() }) {
  return new AuthService(prisma, new JwtService({}), makeConfig(), queue);
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

describe('AuthService.login (req-1)', () => {
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() } };
    service = makeService(prisma);
  });

  it('valid credentials → access + refresh + user (no passwordHash leaked)', async () => {
    const passwordHash = await service.hashPassword('correct-horse');
    prisma.user.findUnique.mockResolvedValue({
      id: 'ext1',
      email: 'c@x.com',
      userType: 'EXTERNAL',
      status: 'ACTIVE',
      passwordHash,
      pwResetTokenHash: null,
      pwResetTokenExp: null,
    });

    const res = await service.login('C@x.com', 'correct-horse');

    expect(res.accessToken).toBeTruthy();
    expect(res.refreshToken).toBeTruthy();
    expect(res.user.id).toBe('ext1');
    expect((res.user as any).passwordHash).toBeUndefined();
  });

  it('wrong password → 401 generic', async () => {
    const passwordHash = await service.hashPassword('correct-horse');
    prisma.user.findUnique.mockResolvedValue({
      id: 'ext1', userType: 'EXTERNAL', status: 'ACTIVE', passwordHash,
    });
    await expect(service.login('c@x.com', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('INVITED user → 401 (not yet active)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'ext1', userType: 'EXTERNAL', status: 'INVITED', passwordHash: null,
    });
    await expect(service.login('c@x.com', 'whatever')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('LOCKED user → 401', async () => {
    const passwordHash = await service.hashPassword('pw12345678');
    prisma.user.findUnique.mockResolvedValue({
      id: 'ext1', userType: 'EXTERNAL', status: 'LOCKED', passwordHash,
    });
    await expect(service.login('c@x.com', 'pw12345678')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('INTERNAL user cannot use password login → 401', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'int1', userType: 'INTERNAL', status: 'ACTIVE', passwordHash: null,
    });
    await expect(service.login('c@x.com', 'x')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.refresh (req-5)', () => {
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: vi.fn(), update: vi.fn() } };
    service = makeService(prisma);
  });

  it('valid refresh → new access + refresh pair', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'ext1', userType: 'EXTERNAL', status: 'ACTIVE' });
    const { refreshToken } = service.signTokens({ id: 'ext1' });

    const res = await service.refresh(refreshToken);

    expect(res.accessToken).toBeTruthy();
    expect(res.refreshToken).toBeTruthy();
  });

  it('expired refresh token → 401', async () => {
    const expired = new JwtService({}).sign(
      { sub: 'ext1', typ: 'refresh' },
      { secret: SECRET, issuer: 'pulsetrack', expiresIn: '-10s' },
    );
    await expect(service.refresh(expired)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('an access token cannot be used as a refresh token → 401', async () => {
    const { accessToken } = service.signTokens({ id: 'ext1' });
    await expect(service.refresh(accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.setPassword (req-7)', () => {
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findFirst: vi.fn(), update: vi.fn() } };
    service = makeService(prisma);
  });

  it('valid token + 8+ char password → activates, burns token, signs in', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'ext1', pwResetTokenHash: sha256('rawtoken'), pwResetTokenExp: new Date(Date.now() + 10000),
    });
    prisma.user.update.mockResolvedValue({ id: 'ext1', status: 'ACTIVE' });

    const res = await service.setPassword('rawtoken', 'password123');

    const updateArg = prisma.user.update.mock.calls[0][0];
    expect(updateArg.data.status).toBe('ACTIVE');
    expect(updateArg.data.passwordHash).toBeTruthy();
    expect(updateArg.data.pwResetTokenHash).toBeNull();
    expect(updateArg.data.pwResetTokenExp).toBeNull();
    expect(res.accessToken).toBeTruthy();
  });

  it('reused/unknown token → 400, no password set', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.setPassword('gone', 'password123')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('expired token → 400', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'ext1', pwResetTokenHash: sha256('rawtoken'), pwResetTokenExp: new Date(Date.now() - 1000),
    });
    await expect(service.setPassword('rawtoken', 'password123')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('password under 8 chars → 400', async () => {
    await expect(service.setPassword('rawtoken', 'short')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});

describe('AuthService.forgotPassword (req-8)', () => {
  let prisma: any;
  let queue: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) } };
    queue = { add: vi.fn() };
    service = makeService(prisma, queue);
  });

  it('known external email → issues token + enqueues set-password email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'ext1', email: 'c@x.com', userType: 'EXTERNAL' });

    await service.forgotPassword('c@x.com');

    expect(prisma.user.update).toHaveBeenCalled(); // token stored
    expect(queue.add).toHaveBeenCalledWith('set-password', expect.objectContaining({ email: 'c@x.com' }));
  });

  it('unknown email → same neutral flow, no email sent', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.forgotPassword('nobody@x.com')).resolves.toBeUndefined();

    expect(queue.add).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('internal email → no reset email (Keycloak owns their auth)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'int1', email: 'i@x.com', userType: 'INTERNAL' });

    await service.forgotPassword('i@x.com');

    expect(queue.add).not.toHaveBeenCalled();
  });
});
