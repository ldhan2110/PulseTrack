import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtStrategy as JwtStrategyType } from './jwt.strategy';

vi.mock('@nestjs/passport', () => ({
  PassportStrategy: (_Strategy: any) => {
    return class MockPassportStrategy {
      constructor(_options: any) {}
    };
  },
}));

vi.mock('passport-jwt', () => ({
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: vi.fn(() => vi.fn()),
  },
  Strategy: class MockStrategy {},
}));

vi.mock('jwks-rsa', () => ({
  passportJwtSecret: vi.fn(() => vi.fn()),
}));

import { JwtStrategy } from './jwt.strategy';

function createStrategy(mockUser: any = null): JwtStrategyType {
  const mockConfigService = {
    get: vi.fn((key: string) => {
      if (key === 'KEYCLOAK_URL') return 'http://localhost:8080';
      if (key === 'KEYCLOAK_REALM') return 'test';
      return undefined;
    }),
  } as any;

  const mockPrismaService = {
    user: {
      findUnique: vi.fn().mockResolvedValue(mockUser),
    },
  } as any;

  return new JwtStrategy(mockConfigService, mockPrismaService);
}

describe('JwtStrategy', () => {
  describe('validate()', () => {
    it('returns the DB user when keycloakId exists in User table', async () => {
      const dbUser = {
        id: 'cuid-123',
        keycloakId: 'kc-sub-123',
        email: 'user@example.com',
        username: 'testuser',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const strategy = createStrategy(dbUser);

      const payload = {
        sub: 'kc-sub-123',
        email: 'user@example.com',
        preferred_username: 'testuser',
        realm_access: { roles: ['pm'] },
      };

      const result = await strategy.validate(payload);
      expect(result).toEqual(dbUser);
    });

    it('throws UnauthorizedException when keycloakId is not in User table', async () => {
      const strategy = createStrategy(null);

      const payload = {
        sub: 'unknown-sub',
        email: 'nobody@example.com',
        preferred_username: 'nobody',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow(
        'You are not allowed to access the app',
      );
    });
  });
});
