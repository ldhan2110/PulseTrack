import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

function makeStrategy(prisma: any) {
  const config = {
    get: vi.fn((k: string) => {
      if (k === 'KEYCLOAK_URL') return 'https://kc.example';
      if (k === 'KEYCLOAK_REALM') return 'CLV';
      if (k === 'BLUEPRINT_URL') return 'https://bp.example';
      return undefined;
    }),
  } as any;
  return new JwtStrategy(config, prisma);
}

const kcPayload = {
  sub: 'kc-sub',
  email: 'ceo@company.com',
  preferred_username: 'ceo',
};

describe('JwtStrategy.validate — anti-squatting (req-3)', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = { user: { findUnique: vi.fn(), update: vi.fn() } };
  });

  it('does NOT claim an EXTERNAL row that shares the email; no access granted', async () => {
    // no keycloakId match
    prisma.user.findUnique.mockResolvedValueOnce(null);
    // email matches an EXTERNAL, unclaimed row
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'ext1',
      email: 'ceo@company.com',
      keycloakId: null,
      userType: 'EXTERNAL',
    });
    const strat = makeStrategy(prisma);

    await expect(strat.validate(kcPayload)).rejects.toBeInstanceOf(UnauthorizedException);
    // the external row was never mutated — keycloakId stays null
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('still claims an INTERNAL pending invite by email (unchanged behaviour)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'int1',
      email: 'ceo@company.com',
      keycloakId: null,
      userType: 'INTERNAL',
    });
    prisma.user.update.mockResolvedValue({
      id: 'int1',
      keycloakId: 'ceo',
      userType: 'INTERNAL',
    });
    const strat = makeStrategy(prisma);

    const result = await strat.validate(kcPayload);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'int1' },
      data: { keycloakId: 'ceo' },
    });
    expect(result.keycloakId).toBe('ceo');
  });

  it('accepts a Keycloak token for an already-claimed internal user (req-2)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'int1',
      keycloakId: 'ceo',
      email: 'ceo@company.com',
      userType: 'INTERNAL',
      name: null,
    });
    const strat = makeStrategy(prisma);

    const result = await strat.validate(kcPayload);

    expect(result.id).toBe('int1');
  });
});
