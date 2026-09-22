import { describe, it, expect, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerStorageService,
  ThrottlerException,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { LoginThrottlerGuard } from './login-throttler.guard';

/**
 * Exercises the actual guard used on POST /auth/login (see auth.controller.ts
 * @UseGuards(LoginThrottlerGuard)) against real in-memory storage — 5 attempts
 * / 60s per IP+email, 6th → 429. Driven directly to avoid Nest DI reflection,
 * which vitest/esbuild doesn't emit metadata for.
 */
function makeContext(email: string, ip = '1.2.3.4') {
  const req = { ip, ips: [] as string[], body: { email } };
  const res = { header: () => {} };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getHandler: () => function handler() {},
    getClass: () => class Ctrl {},
  } as any;
}

describe('LoginThrottlerGuard — login rate limiting (req-9)', () => {
  let guard: LoginThrottlerGuard;
  let storage: ThrottlerStorageService;

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    const options: ThrottlerModuleOptions = [{ name: 'default', ttl: 60000, limit: 5 }];
    guard = new LoginThrottlerGuard(options, storage, new Reflector());
    // ThrottlerGuard builds this.throttlers from options in its module-init hook.
    await guard.onModuleInit();
  });

  it('allows 5 attempts then throws on the 6th (per IP+email)', async () => {
    const ctx = makeContext('attacker@x.com');
    for (let i = 0; i < 5; i++) {
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ThrottlerException);
  });

  it('a different email is tracked separately (not locked out by another account)', async () => {
    const a = makeContext('a@x.com');
    for (let i = 0; i < 5; i++) await guard.canActivate(a);
    await expect(guard.canActivate(a)).rejects.toBeInstanceOf(ThrottlerException);

    // fresh email under the same IP is still allowed
    const b = makeContext('b@x.com');
    await expect(guard.canActivate(b)).resolves.toBe(true);
  });
});
