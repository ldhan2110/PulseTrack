import { describe, it, expect, vi } from 'vitest';

// We test the validate() method which is pure business logic (no JWKS network call needed)
// JwtStrategy constructor calls super() which sets up passport-jwt — we mock that away
vi.mock('@nestjs/passport', () => ({
  PassportStrategy: (Strategy: any) => {
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

// Import after mocks
const { JwtStrategy } = await import('./jwt.strategy');

describe('JwtStrategy', () => {
  function createStrategy() {
    const mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'KEYCLOAK_URL') return 'http://localhost:8080';
        if (key === 'KEYCLOAK_REALM') return 'test';
        return undefined;
      }),
    } as any;
    return new JwtStrategy(mockConfigService);
  }

  describe('validate()', () => {
    it('extracts sub, email, preferred_username, and realm_access.roles from JWT payload', async () => {
      const strategy = createStrategy();
      const payload = {
        sub: 'user-123',
        email: 'user@example.com',
        preferred_username: 'testuser',
        realm_access: { roles: ['pm', 'default-roles-realm'] },
      };
      const result = await strategy.validate(payload);
      expect(result).toEqual({
        sub: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
        roles: ['pm', 'default-roles-realm'],
      });
    });

    it('returns empty roles array when realm_access is missing from JWT', async () => {
      const strategy = createStrategy();
      const payload = {
        sub: 'user-456',
        email: 'user2@example.com',
        preferred_username: 'testuser2',
        // realm_access intentionally absent
      };
      const result = await strategy.validate(payload);
      expect(result).toEqual({
        sub: 'user-456',
        email: 'user2@example.com',
        username: 'testuser2',
        roles: [],
      });
    });

    it('returns empty roles array when realm_access has no roles property', async () => {
      const strategy = createStrategy();
      const payload = {
        sub: 'user-789',
        email: 'user3@example.com',
        preferred_username: 'testuser3',
        realm_access: { roles: undefined as any },
      };
      const result = await strategy.validate(payload);
      expect(result.roles).toEqual([]);
    });
  });
});
