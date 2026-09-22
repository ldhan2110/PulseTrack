import { describe, it, expect } from 'vitest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController.getMe — no secret leak (req-4)', () => {
  it('strips secret fields from /users/me', () => {
    const service = new UsersService({} as any, {} as any);
    const controller = new UsersController(service);
    const req = {
      user: {
        id: 'u1',
        name: 'Jane',
        passwordHash: 'secret',
        pwResetTokenHash: 'tok',
        pwResetTokenExp: new Date(),
      },
    };
    const res = controller.getMe(req) as any;
    expect(res.passwordHash).toBeUndefined();
    expect(res.pwResetTokenHash).toBeUndefined();
    expect(res.pwResetTokenExp).toBeUndefined();
    expect(res.id).toBe('u1');
  });
});
