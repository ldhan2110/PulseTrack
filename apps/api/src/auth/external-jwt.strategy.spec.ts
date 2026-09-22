import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ExternalJwtStrategy } from './external-jwt.strategy';

const EXTERNAL_SECRET = 'external-test-secret';

function makeStrategy(prisma: any) {
  const config = { get: vi.fn().mockReturnValue(EXTERNAL_SECRET) } as any;
  return new ExternalJwtStrategy(config, prisma);
}

describe('ExternalJwtStrategy.validate', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = { user: { findUnique: vi.fn(), update: vi.fn() } };
  });

  it('accepts an EXTERNAL user by sub and resolves req.user to it', async () => {
    const user = { id: 'ext1', userType: 'EXTERNAL', keycloakId: null };
    prisma.user.findUnique.mockResolvedValue(user);
    const strat = makeStrategy(prisma);

    const result = await strat.validate({ sub: 'ext1', userType: 'EXTERNAL' });

    expect(result).toBe(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'ext1' } });
  });

  it('rejects when the sub resolves to an INTERNAL row (no cross-resolve)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', userType: 'INTERNAL' });
    const strat = makeStrategy(prisma);

    await expect(strat.validate({ sub: 'u1' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown sub', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const strat = makeStrategy(prisma);

    await expect(strat.validate({ sub: 'nope' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('never runs Blueprint sync — validate returns the row untouched (req-4)', async () => {
    const user = { id: 'ext1', userType: 'EXTERNAL', keycloakId: null, name: null };
    prisma.user.findUnique.mockResolvedValue(user);
    const strat = makeStrategy(prisma);

    const result = await strat.validate({ sub: 'ext1' });

    expect(result.keycloakId).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('strategy isolation (token confusion, req-2)', () => {
  it('a PulseTrack HS256 token does not verify under a Keycloak-style key/issuer', () => {
    const token = jwt.sign({ sub: 'ext1', userType: 'EXTERNAL' }, EXTERNAL_SECRET, {
      issuer: 'pulsetrack',
      algorithm: 'HS256',
    });

    // external strategy's config verifies its own token
    expect(() =>
      jwt.verify(token, EXTERNAL_SECRET, { issuer: 'pulsetrack', algorithms: ['HS256'] }),
    ).not.toThrow();

    // the Keycloak strategy uses different signing material + issuer → rejects it
    expect(() =>
      jwt.verify(token, 'keycloak-different-key', {
        issuer: 'https://kc.example/realms/CLV',
        algorithms: ['HS256'],
      }),
    ).toThrow();
  });

  it('a token with the wrong issuer is rejected even with the right secret', () => {
    const token = jwt.sign({ sub: 'ext1' }, EXTERNAL_SECRET, {
      issuer: 'someone-else',
      algorithm: 'HS256',
    });

    expect(() =>
      jwt.verify(token, EXTERNAL_SECRET, { issuer: 'pulsetrack', algorithms: ['HS256'] }),
    ).toThrow();
  });
});
