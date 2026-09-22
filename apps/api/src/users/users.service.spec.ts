import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from './users.service';

describe('UsersService.findAll — directory scoping (req-10)', () => {
  let prisma: any;
  let service: UsersService;

  beforeEach(() => {
    prisma = { user: { findMany: vi.fn().mockResolvedValue([]) } };
    service = new UsersService(prisma);
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
